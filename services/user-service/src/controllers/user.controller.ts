import { Request, Response, NextFunction } from 'express';
import { logger } from '@auth/shared';
import { userService } from '../services/user.service';

export class UserController {
  /**
   * GET /users/me
   * Get current user profile
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const profile = await userService.getProfile(userId);

      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /users/me
   * Update current user profile
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const { name, phoneNumber, bio, preferences } = req.body;

      const profile = await userService.updateProfile(userId, {
        name,
        phoneNumber,
        bio,
        preferences,
      });

      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /users/me/avatar
   * Upload user avatar
   */
  async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      if (!req.file) {
        throw new Error('No file uploaded');
      }

      const result = await userService.uploadAvatar(userId, req.file);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /users/me/deactivate
   * Deactivate user account
   */
  async deactivateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const { password } = req.body;

      if (!password) {
        throw new Error('Password is required');
      }

      await userService.deactivateAccount(userId, password);

      res.status(200).json({
        message: 'Account deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /users/me
   * Delete user account (soft delete)
   */
  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const { password } = req.body;

      if (!password) {
        throw new Error('Password is required');
      }

      await userService.deleteAccount(userId, password);

      res.status(200).json({
        message: 'Account deletion scheduled. Your data will be permanently deleted in 30 days.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /users/me/data-export
   * Export user data (GDPR)
   */
  async exportData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const result = await userService.exportUserData(userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
