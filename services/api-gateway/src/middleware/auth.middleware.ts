import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, UnauthorizedError, TokenExpiredError, InvalidTokenError } from '@auth/shared';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
    sessionId: string;
  };
}

export const authenticationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new UnauthorizedError('No authorization header provided');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Invalid authorization header format');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    // Verify and decode token
    const decoded = await verifyAccessToken(token);

    // Attach user information to request
    (req as AuthenticatedRequest).user = {
      id: decoded.sub,
      email: decoded.email,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      sessionId: decoded.sessionId || '',
    };

    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
        },
      });
      return;
    }

    if (error instanceof InvalidTokenError) {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid access token',
        },
      });
      return;
    }

    if (error instanceof UnauthorizedError) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: error.message,
        },
      });
      return;
    }

    // Pass other errors to error handler
    next(error);
  }
};

// Optional authentication - doesn't fail if no token provided
export const optionalAuthenticationMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token) {
        const decoded = await verifyAccessToken(token);
        (req as AuthenticatedRequest).user = {
          id: decoded.sub,
          email: decoded.email,
          roles: decoded.roles || [],
          permissions: decoded.permissions || [],
          sessionId: decoded.sessionId || '',
        };
      }
    }
  } catch (error) {
    // Silently ignore authentication errors for optional auth
  }
  
  next();
};
