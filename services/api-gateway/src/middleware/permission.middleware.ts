import { Request, Response, NextFunction } from 'express';
import { logger } from '@auth/shared';
import axios from 'axios';

/**
 * Middleware to check if user has required permission
 * Usage: requirePermission('users:write')
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = (req as any).user;

      if (!user || !user.userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      // Check if user has the required permission
      const hasPermission = await checkUserPermission(user.userId, permission);

      if (!hasPermission) {
        logger.warn('Permission denied', {
          userId: user.userId,
          permission,
          path: req.path,
        });

        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          },
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check failed', {
        error: (error as Error).message,
        permission,
      });

      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Permission check failed',
        },
      });
    }
  };
}

/**
 * Middleware to check if user has admin role
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> {
  try {
    const user = (req as any).user;

    if (!user || !user.userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Check if user has admin:access permission
    const hasAdminAccess = await checkUserPermission(user.userId, 'admin:access');

    if (!hasAdminAccess) {
      logger.warn('Admin access denied', {
        userId: user.userId,
        path: req.path,
      });

      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
    }

    next();
  } catch (error) {
    logger.error('Admin check failed', {
      error: (error as Error).message,
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Admin check failed',
      },
    });
  }
}

/**
 * Check if user has a specific permission
 * Calls the user service to get user permissions
 */
async function checkUserPermission(userId: string, permission: string): Promise<boolean> {
  try {
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3002';

    const response = await axios.get(`${userServiceUrl}/api/v1/users/${userId}/permissions`, {
      timeout: 5000,
    });

    const permissions: string[] = response.data.permissions || [];

    return permissions.includes(permission);
  } catch (error) {
    logger.error('Failed to fetch user permissions', {
      userId,
      error: (error as Error).message,
    });

    // Fail closed - deny access if we can't verify permissions
    return false;
  }
}

/**
 * Middleware to check if user has any of the required permissions
 * Usage: requireAnyPermission(['users:read', 'users:write'])
 */
export function requireAnyPermission(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = (req as any).user;

      if (!user || !user.userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      // Check if user has any of the required permissions
      for (const permission of permissions) {
        const hasPermission = await checkUserPermission(user.userId, permission);

        if (hasPermission) {
          return next();
        }
      }

      logger.warn('Permission denied - none of required permissions found', {
        userId: user.userId,
        requiredPermissions: permissions,
        path: req.path,
      });

      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    } catch (error) {
      logger.error('Permission check failed', {
        error: (error as Error).message,
        permissions,
      });

      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Permission check failed',
        },
      });
    }
  };
}

/**
 * Middleware to check if user has all of the required permissions
 * Usage: requireAllPermissions(['users:read', 'users:write'])
 */
export function requireAllPermissions(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = (req as any).user;

      if (!user || !user.userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      // Check if user has all of the required permissions
      for (const permission of permissions) {
        const hasPermission = await checkUserPermission(user.userId, permission);

        if (!hasPermission) {
          logger.warn('Permission denied - missing required permission', {
            userId: user.userId,
            missingPermission: permission,
            path: req.path,
          });

          return res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient permissions',
            },
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Permission check failed', {
        error: (error as Error).message,
        permissions,
      });

      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Permission check failed',
        },
      });
    }
  };
}
