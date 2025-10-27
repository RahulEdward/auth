import { Request, Response } from 'express';
import { AdminService } from '../services/admin.service';
import { logger } from '@auth/shared';

const adminService = new AdminService();

export class AdminController {
  // Get all users with pagination and filtering
  async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        role,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query;

      const result = await adminService.getAllUsers({
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        role: role as string,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      res.json(result);
    } catch (error) {
      logger.error('Failed to get all users', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve users',
        },
      });
    }
  }

  // Search users by email, name, or ID
  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.query;

      if (!query) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Search query is required',
          },
        });
        return;
      }

      const users = await adminService.searchUsers(query as string);

      res.json({ users });
    } catch (error) {
      logger.error('Failed to search users', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to search users',
        },
      });
    }
  }

  // Get user details with full profile
  async getUserDetails(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const userDetails = await adminService.getUserDetails(userId);

      if (!userDetails) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
        return;
      }

      res.json(userDetails);
    } catch (error) {
      logger.error('Failed to get user details', { error, userId: req.params.userId });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve user details',
        },
      });
    }
  }

  // Update user status (activate/deactivate)
  async updateUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { status } = req.body;
      const adminId = (req as any).user?.id;

      if (!['active', 'deactivated'].includes(status)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid status. Must be "active" or "deactivated"',
          },
        });
        return;
      }

      await adminService.updateUserStatus(userId, status, adminId);

      res.json({
        message: 'User status updated successfully',
        userId,
        status,
      });
    } catch (error) {
      logger.error('Failed to update user status', { error, userId: req.params.userId });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update user status',
        },
      });
    }
  }

  // Delete user account (admin override)
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const adminId = (req as any).user?.id;

      await adminService.deleteUser(userId, adminId);

      res.json({
        message: 'User deleted successfully',
        userId,
      });
    } catch (error) {
      logger.error('Failed to delete user', { error, userId: req.params.userId });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete user',
        },
      });
    }
  }

  // Impersonate user (with audit logging)
  async impersonateUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const adminId = (req as any).user?.id;

      const impersonationToken = await adminService.impersonateUser(userId, adminId);

      res.json({
        message: 'Impersonation token generated',
        token: impersonationToken,
        userId,
      });
    } catch (error) {
      logger.error('Failed to impersonate user', { error, userId: req.params.userId });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to impersonate user',
        },
      });
    }
  }
}

export const adminController = new AdminController();

  // Get system metrics
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await adminService.getSystemMetrics();
      res.json(metrics);
    } catch (error) {
      logger.error('Failed to get metrics', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve metrics',
        },
      });
    }
  }

  // Get user growth over time
  async getUserGrowth(req: Request, res: Response): Promise<void> {
    try {
      const { period = '30d' } = req.query;
      const growth = await adminService.getUserGrowth(period as string);
      res.json({ growth });
    } catch (error) {
      logger.error('Failed to get user growth', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve user growth data',
        },
      });
    }
  }

  // Get authentication method breakdown
  async getAuthMethodBreakdown(req: Request, res: Response): Promise<void> {
    try {
      const breakdown = await adminService.getAuthMethodBreakdown();
      res.json({ breakdown });
    } catch (error) {
      logger.error('Failed to get auth method breakdown', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve authentication method breakdown',
        },
      });
    }
  }

  // Get subscription tier distribution
  async getSubscriptionDistribution(req: Request, res: Response): Promise<void> {
    try {
      const distribution = await adminService.getSubscriptionDistribution();
      res.json({ distribution });
    } catch (error) {
      logger.error('Failed to get subscription distribution', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve subscription distribution',
        },
      });
    }
  }

  // Get API usage by endpoint
  async getApiUsage(req: Request, res: Response): Promise<void> {
    try {
      const { period = '24h' } = req.query;
      const usage = await adminService.getApiUsage(period as string);
      res.json({ usage });
    } catch (error) {
      logger.error('Failed to get API usage', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve API usage data',
        },
      });
    }
  }
}


  // Get audit logs with pagination
  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 50,
        userId,
        action,
        resource,
        startDate,
        endDate,
        search,
      } = req.query;

      const result = await adminService.getAuditLogs({
        page: Number(page),
        limit: Number(limit),
        userId: userId as string,
        action: action as string,
        resource: resource as string,
        startDate: startDate as string,
        endDate: endDate as string,
        search: search as string,
      });

      res.json(result);
    } catch (error) {
      logger.error('Failed to get audit logs', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve audit logs',
        },
      });
    }
  }

  // Export audit logs to CSV/JSON
  async exportAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const { format = 'json', ...filters } = req.query;

      const data = await adminService.exportAuditLogs(filters);

      if (format === 'csv') {
        // Convert to CSV
        const csv = this.convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
        res.send(csv);
      } else {
        // Return as JSON
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
        res.json(data);
      }
    } catch (error) {
      logger.error('Failed to export audit logs', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to export audit logs',
        },
      });
    }
  }

  // Helper: Convert data to CSV
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        const escaped = ('' + value).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}


  // Get system settings
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.query;
      const settings = await adminService.getSettings(category as string);
      res.json(settings);
    } catch (error) {
      logger.error('Failed to get settings', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve settings',
        },
      });
    }
  }

  // Update system settings
  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { category, settings } = req.body;
      const adminId = (req as any).user?.id;

      await adminService.updateSettings(category, settings, adminId);

      res.json({
        message: 'Settings updated successfully',
        category,
      });
    } catch (error) {
      logger.error('Failed to update settings', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update settings',
        },
      });
    }
  }
}
