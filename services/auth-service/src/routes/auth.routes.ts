import { Router } from 'express';

import { authController } from '../controllers/auth.controller';
import oauthRoutes from './oauth.routes';

const router = Router();

// Registration and verification
router.post('/register', authController.register.bind(authController));
router.get('/verify-email', authController.verifyEmail.bind(authController));

// Login
router.post('/login', authController.login.bind(authController));

// Password reset
router.post('/password/reset-request', authController.requestPasswordReset.bind(authController));
router.post('/password/reset', authController.resetPassword.bind(authController));

// Token refresh
router.post('/refresh', authController.refreshToken.bind(authController));

// OAuth routes
router.use('/', oauthRoutes);

export default router;
