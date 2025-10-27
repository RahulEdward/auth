import { db, redis, logger } from '@auth/shared';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  parentRoleId?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateRoleInput {
  name: string;
  description: string;
  permissions: string[];
  parentRoleId?: string;
}

interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
  parentRoleId?: string;
}

interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
}

export class RBACService {
  /**
   * Create a new role
   */
  async createRole(input: CreateRoleInput): Promise<Role> {
    const { name, description, permissions, parentRoleId } = input;

    // Check if role name already exists
    const existingRole = await db.query('SELECT id FROM roles WHERE name = $1', [name]);

    if (existingRole.rows.length > 0) {
      throw new Error('Role name already exists');
    }

    // Validate parent role if provided
    if (parentRoleId) {
      const parentRole = await db.query('SELECT id FROM roles WHERE id = $1', [parentRoleId]);

      if (parentRole.rows.length === 0) {
        throw new Error('Parent role not found');
      }
    }

    // Validate permissions exist
    await this.validatePermissions(permissions);

    // Create role
    const result = await db.query(
      `INSERT INTO roles (name, description, permissions, parent_role_id, is_system)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, permissions, parent_role_id, is_system, created_at, updated_at`,
      [name, description, permissions, parentRoleId || null, false]
    );

    const role = this.mapRoleFromDb(result.rows[0]);

    logger.info('Role created', { roleId: role.id, name: role.name });

    return role;
  }

  /**
   * Get all roles
   */
  async getRoles(): Promise<Role[]> {
    const result = await db.query(
      `SELECT id, name, description, permissions, parent_role_id, is_system, created_at, updated_at
       FROM roles
       ORDER BY name ASC`
    );

    return result.rows.map((row) => this.mapRoleFromDb(row));
  }

  /**
   * Get role by ID
   */
  async getRoleById(roleId: string): Promise<Role | null> {
    const result = await db.query(
      `SELECT id, name, description, permissions, parent_role_id, is_system, created_at, updated_at
       FROM roles
       WHERE id = $1`,
      [roleId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRoleFromDb(result.rows[0]);
  }

  /**
   * Update role
   */
  async updateRole(roleId: string, input: UpdateRoleInput): Promise<Role> {
    // Check if role exists and is not a system role
    const existingRole = await db.query('SELECT is_system FROM roles WHERE id = $1', [roleId]);

    if (existingRole.rows.length === 0) {
      throw new Error('Role not found');
    }

    if (existingRole.rows[0].is_system) {
      throw new Error('Cannot update system role');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      // Check if new name already exists
      const nameCheck = await db.query('SELECT id FROM roles WHERE name = $1 AND id != $2', [
        input.name,
        roleId,
      ]);

      if (nameCheck.rows.length > 0) {
        throw new Error('Role name already exists');
      }

      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }

    if (input.permissions !== undefined) {
      // Validate permissions
      await this.validatePermissions(input.permissions);

      updates.push(`permissions = $${paramIndex++}`);
      values.push(input.permissions);
    }

    if (input.parentRoleId !== undefined) {
      if (input.parentRoleId) {
        // Validate parent role exists
        const parentRole = await db.query('SELECT id FROM roles WHERE id = $1', [
          input.parentRoleId,
        ]);

        if (parentRole.rows.length === 0) {
          throw new Error('Parent role not found');
        }

        // Prevent circular inheritance
        if (input.parentRoleId === roleId) {
          throw new Error('Role cannot be its own parent');
        }
      }

      updates.push(`parent_role_id = $${paramIndex++}`);
      values.push(input.parentRoleId || null);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(roleId);

    const query = `
      UPDATE roles 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, description, permissions, parent_role_id, is_system, created_at, updated_at
    `;

    const result = await db.query(query, values);

    // Invalidate permission cache for users with this role
    await this.invalidateRolePermissionCache(roleId);

    logger.info('Role updated', { roleId });

    return this.mapRoleFromDb(result.rows[0]);
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<void> {
    // Check if role exists and is not a system role
    const existingRole = await db.query('SELECT is_system FROM roles WHERE id = $1', [roleId]);

    if (existingRole.rows.length === 0) {
      throw new Error('Role not found');
    }

    if (existingRole.rows[0].is_system) {
      throw new Error('Cannot delete system role');
    }

    // Check if any users have this role
    const usersWithRole = await db.query('SELECT COUNT(*) as count FROM user_roles WHERE role_id = $1', [
      roleId,
    ]);

    if (parseInt(usersWithRole.rows[0].count, 10) > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }

    // Delete role
    await db.query('DELETE FROM roles WHERE id = $1', [roleId]);

    logger.info('Role deleted', { roleId });
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(userId: string, roleId: string, assignedBy: string): Promise<void> {
    // Verify user exists
    const userExists = await db.query('SELECT id FROM users WHERE id = $1', [userId]);

    if (userExists.rows.length === 0) {
      throw new Error('User not found');
    }

    // Verify role exists
    const roleExists = await db.query('SELECT id FROM roles WHERE id = $1', [roleId]);

    if (roleExists.rows.length === 0) {
      throw new Error('Role not found');
    }

    // Check if user already has this role
    const existingAssignment = await db.query(
      'SELECT * FROM user_roles WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    );

    if (existingAssignment.rows.length > 0) {
      throw new Error('User already has this role');
    }

    // Assign role
    await db.query(
      'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
      [userId, roleId, assignedBy]
    );

    // Invalidate user permission cache
    await redis.del(`user_permissions:${userId}`);
    await redis.del(`user_profile:${userId}`);

    // Create audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address, user_agent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [assignedBy, 'ASSIGN_ROLE', 'user', userId, '0.0.0.0', 'system', 'success']
    );

    logger.info('Role assigned to user', { userId, roleId, assignedBy });
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(userId: string, roleId: string, removedBy: string): Promise<void> {
    // Check if assignment exists
    const existingAssignment = await db.query(
      'SELECT * FROM user_roles WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    );

    if (existingAssignment.rows.length === 0) {
      throw new Error('User does not have this role');
    }

    // Remove role
    await db.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);

    // Invalidate user permission cache
    await redis.del(`user_permissions:${userId}`);
    await redis.del(`user_profile:${userId}`);

    // Create audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address, user_agent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [removedBy, 'REMOVE_ROLE', 'user', userId, '0.0.0.0', 'system', 'success']
    );

    logger.info('Role removed from user', { userId, roleId, removedBy });
  }

  /**
   * Get user permissions (with inheritance)
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    // Check cache first
    const cacheKey = `user_permissions:${userId}`;
    const cachedPermissions = await redis.get(cacheKey);

    if (cachedPermissions) {
      return JSON.parse(cachedPermissions);
    }

    // Get all roles for user
    const userRoles = await db.query(
      `SELECT r.id, r.permissions, r.parent_role_id
       FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId]
    );

    const permissions = new Set<string>();

    // Collect permissions from all roles (including inherited)
    for (const role of userRoles.rows) {
      // Add direct permissions
      if (role.permissions) {
        role.permissions.forEach((p: string) => permissions.add(p));
      }

      // Add inherited permissions
      if (role.parent_role_id) {
        const inheritedPermissions = await this.getInheritedPermissions(role.parent_role_id);
        inheritedPermissions.forEach((p) => permissions.add(p));
      }
    }

    const permissionsArray = Array.from(permissions);

    // Cache for 10 minutes
    await redis.set(cacheKey, JSON.stringify(permissionsArray), 10 * 60);

    return permissionsArray;
  }

  /**
   * Check if user has permission
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  /**
   * Get all available permissions
   */
  async getPermissions(): Promise<Permission[]> {
    // In a real system, this would come from a database table
    // For now, we'll return a predefined list
    const permissions: Permission[] = [
      // User permissions
      { id: '1', resource: 'users', action: 'read', description: 'View user information' },
      { id: '2', resource: 'users', action: 'write', description: 'Create and update users' },
      { id: '3', resource: 'users', action: 'delete', description: 'Delete users' },

      // Role permissions
      { id: '4', resource: 'roles', action: 'read', description: 'View roles' },
      { id: '5', resource: 'roles', action: 'write', description: 'Create and update roles' },
      { id: '6', resource: 'roles', action: 'delete', description: 'Delete roles' },

      // Session permissions
      { id: '7', resource: 'sessions', action: 'read', description: 'View sessions' },
      { id: '8', resource: 'sessions', action: 'write', description: 'Manage sessions' },

      // Subscription permissions
      { id: '9', resource: 'subscriptions', action: 'read', description: 'View subscriptions' },
      { id: '10', resource: 'subscriptions', action: 'write', description: 'Manage subscriptions' },

      // Payment permissions
      { id: '11', resource: 'payments', action: 'read', description: 'View payments' },
      { id: '12', resource: 'payments', action: 'write', description: 'Process payments' },

      // Admin permissions
      { id: '13', resource: 'admin', action: 'access', description: 'Access admin dashboard' },
      { id: '14', resource: 'admin', action: 'manage', description: 'Full admin access' },
    ];

    return permissions;
  }

  /**
   * Get inherited permissions from parent roles (recursive)
   */
  private async getInheritedPermissions(roleId: string): Promise<string[]> {
    const role = await db.query(
      'SELECT permissions, parent_role_id FROM roles WHERE id = $1',
      [roleId]
    );

    if (role.rows.length === 0) {
      return [];
    }

    const permissions = new Set<string>(role.rows[0].permissions || []);

    // Recursively get parent permissions
    if (role.rows[0].parent_role_id) {
      const parentPermissions = await this.getInheritedPermissions(role.rows[0].parent_role_id);
      parentPermissions.forEach((p) => permissions.add(p));
    }

    return Array.from(permissions);
  }

  /**
   * Validate that permissions exist
   */
  private async validatePermissions(permissions: string[]): Promise<void> {
    const availablePermissions = await this.getPermissions();
    const validPermissions = availablePermissions.map((p) => `${p.resource}:${p.action}`);

    for (const permission of permissions) {
      if (!validPermissions.includes(permission)) {
        throw new Error(`Invalid permission: ${permission}`);
      }
    }
  }

  /**
   * Invalidate permission cache for all users with a role
   */
  private async invalidateRolePermissionCache(roleId: string): Promise<void> {
    const users = await db.query('SELECT user_id FROM user_roles WHERE role_id = $1', [roleId]);

    for (const user of users.rows) {
      await redis.del(`user_permissions:${user.user_id}`);
      await redis.del(`user_profile:${user.user_id}`);
    }
  }

  /**
   * Map database row to Role object
   */
  private mapRoleFromDb(row: any): Role {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      permissions: row.permissions || [],
      parentRoleId: row.parent_role_id,
      isSystem: row.is_system,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const rbacService = new RBACService();
