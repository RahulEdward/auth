import { db, logger, generateTokenPair } from '@auth/shared';

interface GetAllUsersOptions {
  page: number;
  limit: number;
  status?: string;
  role?: string;
  search?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export class AdminService {
  // Get all users with pagination and filtering
  async getAllUsers(options: GetAllUsersOptions) {
    const { page, limit, status, role, search, sortBy, sortOrder } = options;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        u.id,
        u.email,
        u.email_verified,
        u.name,
        u.avatar_url,
        u.phone_number,
        u.status,
        u.created_at,
        u.updated_at,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', r.id, 'name', r.name)
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Filter by status
    if (status) {
      query += ` AND u.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Filter by role
    if (role) {
      query += ` AND EXISTS (
        SELECT 1 FROM user_roles ur2
        JOIN roles r2 ON ur2.role_id = r2.id
        WHERE ur2.user_id = u.id AND r2.name = $${paramIndex}
      )`;
      params.push(role);
      paramIndex++;
    }

    // Search by email or name
    if (search) {
      query += ` AND (u.email ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` GROUP BY u.id`;

    // Sorting
    const validSortColumns = ['created_at', 'email', 'name', 'status'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    query += ` ORDER BY u.${sortColumn} ${sortOrder.toUpperCase()}`;

    // Pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM users u WHERE 1=1`;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (status) {
      countQuery += ` AND u.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (role) {
      countQuery += ` AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = u.id AND r.name = $${countParamIndex}
      )`;
      countParams.push(role);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (u.email ILIKE $${countParamIndex} OR u.name ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const [usersResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    return {
      users: usersResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Search users by email, name, or ID
  async searchUsers(searchQuery: string) {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.name,
        u.avatar_url,
        u.status,
        u.created_at
      FROM users u
      WHERE 
        u.email ILIKE $1 OR
        u.name ILIKE $1 OR
        u.id::text = $2
      LIMIT 50
    `;

    const result = await db.query(query, [`%${searchQuery}%`, searchQuery]);
    return result.rows;
  }

  // Get user details with full profile
  async getUserDetails(userId: string) {
    const query = `
      SELECT 
        u.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', r.id,
              'name', r.name,
              'description', r.description
            )
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) as roles,
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', s.id,
              'device_info', s.device_info,
              'ip_address', s.ip_address,
              'created_at', s.created_at,
              'last_activity_at', s.last_activity_at
            )
          )
          FROM sessions s
          WHERE s.user_id = u.id AND s.expires_at > NOW()
        ) as active_sessions,
        (
          SELECT json_build_object(
            'plan_id', sub.plan_id,
            'status', sub.status,
            'current_period_end', sub.current_period_end
          )
          FROM subscriptions sub
          WHERE sub.user_id = u.id AND sub.status = 'active'
          LIMIT 1
        ) as subscription
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  // Update user status
  async updateUserStatus(userId: string, status: string, adminId: string) {
    const query = `
      UPDATE users
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, status
    `;

    const result = await db.query(query, [status, userId]);

    // Create audit log
    await this.createAuditLog({
      userId: adminId,
      action: 'UPDATE_USER_STATUS',
      resource: 'user',
      resourceId: userId,
      changes: { status },
    });

    logger.info('User status updated by admin', { userId, status, adminId });

    return result.rows[0];
  }

  // Delete user account
  async deleteUser(userId: string, adminId: string) {
    // Soft delete - set status to deleted
    const query = `
      UPDATE users
      SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING id, email
    `;

    const result = await db.query(query, [userId]);

    // Revoke all sessions
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);

    // Create audit log
    await this.createAuditLog({
      userId: adminId,
      action: 'DELETE_USER',
      resource: 'user',
      resourceId: userId,
      changes: { deleted: true },
    });

    logger.info('User deleted by admin', { userId, adminId });

    return result.rows[0];
  }

  // Impersonate user
  async impersonateUser(userId: string, adminId: string) {
    // Get user details
    const userResult = await db.query(
      'SELECT id, email, name FROM users WHERE id = $1 AND status = $2',
      [userId, 'active']
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found or not active');
    }

    const user = userResult.rows[0];

    // Get user roles
    const rolesResult = await db.query(
      `SELECT r.name FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId]
    );

    const roles = rolesResult.rows.map((r) => r.name);

    // Generate impersonation token
    const { accessToken } = await generateTokenPair({
      sub: user.id,
      email: user.email,
      roles,
      permissions: [],
      sessionId: `impersonation_${Date.now()}`,
      impersonatedBy: adminId,
    });

    // Create audit log
    await this.createAuditLog({
      userId: adminId,
      action: 'IMPERSONATE_USER',
      resource: 'user',
      resourceId: userId,
      changes: { impersonated: true },
    });

    logger.warn('Admin impersonating user', { userId, adminId });

    return accessToken;
  }

  // Helper: Create audit log
  private async createAuditLog(data: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    changes?: any;
  }) {
    const query = `
      INSERT INTO audit_logs (user_id, action, resource, resource_id, changes, timestamp)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `;

    await db.query(query, [
      data.userId,
      data.action,
      data.resource,
      data.resourceId || null,
      JSON.stringify(data.changes || {}),
    ]);
  }
}


  // Get system metrics
  async getSystemMetrics() {
    // Get total user count
    const totalUsersResult = await db.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult.rows[0].count, 10);

    // Get active session count
    const activeSessionsResult = await db.query(
      'SELECT COUNT(*) as count FROM sessions WHERE expires_at > NOW()'
    );
    const activeSessions = parseInt(activeSessionsResult.rows[0].count, 10);

    // Get failed login attempts in last 24 hours
    const failedLoginsResult = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs
       WHERE action = 'LOGIN_FAILED' AND timestamp > NOW() - INTERVAL '24 hours'`
    );
    const failedLogins = parseInt(failedLoginsResult.rows[0].count, 10);

    // Get revenue metrics (MTD - Month to Date)
    const mtdRevenueResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as revenue
       FROM payments
       WHERE status = 'succeeded'
       AND created_at >= DATE_TRUNC('month', NOW())`
    );
    const mtdRevenue = parseFloat(mtdRevenueResult.rows[0].revenue);

    // Get revenue metrics (YTD - Year to Date)
    const ytdRevenueResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as revenue
       FROM payments
       WHERE status = 'succeeded'
       AND created_at >= DATE_TRUNC('year', NOW())`
    );
    const ytdRevenue = parseFloat(ytdRevenueResult.rows[0].revenue);

    return {
      totalUsers,
      activeSessions,
      failedLogins24h: failedLogins,
      revenue: {
        mtd: mtdRevenue,
        ytd: ytdRevenue,
      },
    };
  }

  // Get user growth over time
  async getUserGrowth(period: string) {
    let interval: string;
    let dateFormat: string;

    switch (period) {
      case '7d':
        interval = '7 days';
        dateFormat = 'YYYY-MM-DD';
        break;
      case '30d':
        interval = '30 days';
        dateFormat = 'YYYY-MM-DD';
        break;
      case '90d':
        interval = '90 days';
        dateFormat = 'YYYY-MM-DD';
        break;
      case '1y':
        interval = '1 year';
        dateFormat = 'YYYY-MM';
        break;
      default:
        interval = '30 days';
        dateFormat = 'YYYY-MM-DD';
    }

    const query = `
      SELECT 
        TO_CHAR(created_at, $1) as date,
        COUNT(*) as count
      FROM users
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY TO_CHAR(created_at, $1)
      ORDER BY date ASC
    `;

    const result = await db.query(query, [dateFormat]);
    return result.rows;
  }

  // Get authentication method breakdown
  async getAuthMethodBreakdown() {
    const query = `
      SELECT 
        CASE 
          WHEN password_hash IS NOT NULL THEN 'password'
          ELSE 'oauth'
        END as method,
        COUNT(*) as count
      FROM users
      GROUP BY method
    `;

    const result = await db.query(query);

    // Also get OAuth provider breakdown
    const oauthQuery = `
      SELECT provider, COUNT(*) as count
      FROM oauth_accounts
      GROUP BY provider
    `;

    const oauthResult = await db.query(oauthQuery);

    return {
      methods: result.rows,
      oauthProviders: oauthResult.rows,
    };
  }

  // Get subscription tier distribution
  async getSubscriptionDistribution() {
    const query = `
      SELECT 
        sp.name as plan_name,
        COUNT(s.id) as count,
        SUM(sp.price) as total_revenue
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.status = 'active'
      GROUP BY sp.id, sp.name, sp.price
      ORDER BY count DESC
    `;

    const result = await db.query(query);
    return result.rows;
  }

  // Get API usage by endpoint
  async getApiUsage(period: string) {
    let interval: string;

    switch (period) {
      case '1h':
        interval = '1 hour';
        break;
      case '24h':
        interval = '24 hours';
        break;
      case '7d':
        interval = '7 days';
        break;
      default:
        interval = '24 hours';
    }

    // This would typically come from API logs or metrics
    // For now, we'll use audit logs as a proxy
    const query = `
      SELECT 
        resource as endpoint,
        COUNT(*) as count
      FROM audit_logs
      WHERE timestamp > NOW() - INTERVAL '${interval}'
      GROUP BY resource
      ORDER BY count DESC
      LIMIT 20
    `;

    const result = await db.query(query);
    return result.rows;
  }
}


  // Get audit logs with pagination and filtering
  async getAuditLogs(options: {
    page: number;
    limit: number;
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const { page, limit, userId, action, resource, startDate, endDate, search } = options;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        al.*,
        u.email as user_email,
        u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Filter by user ID
    if (userId) {
      query += ` AND al.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    // Filter by action
    if (action) {
      query += ` AND al.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    // Filter by resource
    if (resource) {
      query += ` AND al.resource = $${paramIndex}`;
      params.push(resource);
      paramIndex++;
    }

    // Filter by date range
    if (startDate) {
      query += ` AND al.timestamp >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND al.timestamp <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Search in changes or resource_id
    if (search) {
      query += ` AND (al.resource_id ILIKE $${paramIndex} OR al.changes::text ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY al.timestamp DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM audit_logs al WHERE 1=1`;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (userId) {
      countQuery += ` AND al.user_id = $${countParamIndex}`;
      countParams.push(userId);
      countParamIndex++;
    }

    if (action) {
      countQuery += ` AND al.action = $${countParamIndex}`;
      countParams.push(action);
      countParamIndex++;
    }

    if (resource) {
      countQuery += ` AND al.resource = $${countParamIndex}`;
      countParams.push(resource);
      countParamIndex++;
    }

    if (startDate) {
      countQuery += ` AND al.timestamp >= $${countParamIndex}`;
      countParams.push(startDate);
      countParamIndex++;
    }

    if (endDate) {
      countQuery += ` AND al.timestamp <= $${countParamIndex}`;
      countParams.push(endDate);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (al.resource_id ILIKE $${countParamIndex} OR al.changes::text ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const [logsResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    return {
      logs: logsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Export audit logs
  async exportAuditLogs(filters: any) {
    let query = `
      SELECT 
        al.id,
        al.user_id,
        u.email as user_email,
        u.name as user_name,
        al.action,
        al.resource,
        al.resource_id,
        al.changes,
        al.ip_address,
        al.user_agent,
        al.status,
        al.error_message,
        al.timestamp
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      query += ` AND al.user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.action) {
      query += ` AND al.action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.resource) {
      query += ` AND al.resource = $${paramIndex}`;
      params.push(filters.resource);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND al.timestamp >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND al.timestamp <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` ORDER BY al.timestamp DESC LIMIT 10000`;

    const result = await db.query(query, params);
    return result.rows;
  }
}


  // Get system settings
  async getSettings(category?: string) {
    let query = `
      SELECT category, key, value, updated_at, updated_by
      FROM system_settings
    `;

    const params: any[] = [];

    if (category) {
      query += ` WHERE category = $1`;
      params.push(category);
    }

    query += ` ORDER BY category, key`;

    const result = await db.query(query, params);

    // Group by category
    const settings: Record<string, any> = {};
    for (const row of result.rows) {
      if (!settings[row.category]) {
        settings[row.category] = {};
      }
      settings[row.category][row.key] = row.value;
    }

    return category ? settings[category] || {} : settings;
  }

  // Update system settings
  async updateSettings(category: string, settings: Record<string, any>, adminId: string) {
    for (const [key, value] of Object.entries(settings)) {
      const query = `
        INSERT INTO system_settings (category, key, value, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (category, key)
        DO UPDATE SET value = $3, updated_by = $4, updated_at = NOW()
      `;

      await db.query(query, [category, key, JSON.stringify(value), adminId]);
    }

    // Create audit log
    await this.createAuditLog({
      userId: adminId,
      action: 'UPDATE_SETTINGS',
      resource: 'system_settings',
      resourceId: category,
      changes: settings,
    });

    logger.info('System settings updated', { category, adminId });
  }
}
