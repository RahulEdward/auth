import { Router } from 'express';
import { oauthController } from '../controllers/oauth.controller';

const router = Router();

// OAuth authorization initiation
router.get('/oauth/:provider/authorize', oauthController.authorize.bind(oauthController));

// OAuth callback handler
router.get('/oauth/:provider/callback', oauthController.callback.bind(oauthController));

// Link OAuth account (requires authentication)
// Note: This would need authentication middleware in production
router.post('/oauth/link/:provider', oauthController.link.bind(oauthController));

export default router;
