import { Request, Response, NextFunction } from 'express';
import { logger } from '@auth/shared';
import { oauthService } from '../services/oauth.service';

export class OAuthController {
  /**
   * GET /auth/oauth/:provider/authorize
   * Initiate OAuth authorization flow
   */
  async authorize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider } = req.params;
      const { link } = req.query;

      // If link=true, get user ID from authenticated request
      let linkToUserId: string | undefined;
      if (link === 'true' && (req as any).user) {
        linkToUserId = ((req as any).user as any).userId;
      }

      const result = await oauthService.getAuthorizationUrl(provider, linkToUserId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /auth/oauth/:provider/callback
   * Handle OAuth callback from provider
   */
  async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider } = req.params;
      const { code, state, error, error_description } = req.query;

      // Check for OAuth errors
      if (error) {
        logger.error('OAuth provider returned error', {
          provider,
          error,
          error_description,
        });
        
        // Redirect to frontend with error
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth/error?error=${error}&description=${error_description}`);
        return;
      }

      if (!code || typeof code !== 'string') {
        throw new Error('Authorization code is required');
      }

      if (!state || typeof state !== 'string') {
        throw new Error('State parameter is required');
      }

      const ipAddress = (req.ip || req.socket.remoteAddress) as string;
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const tokens = await oauthService.handleCallback(
        provider,
        code,
        state,
        ipAddress,
        userAgent
      );

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&expiresIn=${tokens.expiresIn}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/oauth/link/:provider
   * Link OAuth account to authenticated user
   */
  async link(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider } = req.params;

      if (!(req as any).user) {
        throw new Error('Authentication required');
      }

      const userId = ((req as any).user as any).userId;

      const result = await oauthService.getAuthorizationUrl(provider, userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const oauthController = new OAuthController();
