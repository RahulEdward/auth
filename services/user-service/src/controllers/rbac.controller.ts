import { Request, Response, NextFunction } from 'express';
import { logger } from '@auth/shared';
import { rbacService } from '../services/rbac.service';

export class RBACController {
  /**
   * POST /roles
   * Create a new role (admin only)
   */
  async createRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description, permissions, parentRoleId } = req.body;

      if (!name || !description || !permissions) {
        throw new Error('Name, description, and permissions are required');
      }

      const role = await rbacService.createRole({
        name,
        description,
        permissions,
        parentRoleId,
      });

      res.status(201).json(role);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /roles
   * Get all roles
   */
  async getRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await rbacService.getRoles();

      res.status(200).json({ roles });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /roles/:roleId
   * Get role by ID
   */
  async getRoleById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { roleId } = req.params;

      const role = await rbacService.getRoleById(roleId);

      if (!role) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Role not found',
          },
        });
      }

      res.status(200).json(role);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /roles/:roleId
   * Update role (admin only)
   */
  async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roleId } = req.params;
      const { name, description, permissions, parentRoleId } = req.body;

      const role = await rbacService.updateRole(roleId, {
        name,
        description,
        permissions,
        parentRoleId,
      });

      res.status(200).json(role);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /roles/:roleId
   * Delete role (admin only)
   */
  async deleteRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roleId } = req.params;

      await rbacService.deleteRole(roleId);

      res.status(200).json({
        message: 'Role deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /users/:userId/roles
   * Assign role to user (admin only)
   */
  async assignRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { roleId } = req.body;
      const assignedBy = (req as any).user?.userId;

      if (!roleId) {
        throw new Error('Role ID is required');
      }

      if (!assignedBy) {
        throw new Error('Authentication required');
      }

      await rbacService.assignRoleToUser(userId, roleId, assignedBy);

      res.status(200).json({
        message: 'Role assigned successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /users/:userId/roles/:roleId
   * Remove role from user (admin only)
   */
  async removeRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, roleId } = req.params;
      const removedBy = (req as any).user?.userId;

      if (!removedBy) {
        throw new Error('Authentication required');
      }

      await rbacService.removeRoleFromUser(userId, roleId, removedBy);

      res.status(200).json({
        message: 'Role removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /permissions
   * Get all available permissions
   */
  async getPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const permissions = await rbacService.getPermissions();

      res.status(200).json({ permissions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /users/:userId/permissions
   * Get user permissions (with inheritance)
   */
  async getUserPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;

      const permissions = await rbacService.getUserPermissions(userId);

      res.status(200).json({ permissions });
    } catch (error) {
      next(error);
    }
  }
}

export const rbacController = new RBACController();
