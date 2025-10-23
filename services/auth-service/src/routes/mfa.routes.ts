import { Router } from 'express';
import { mfaController } from '../controllers/mfa.controller';

const router = Router();

// TOTP MFA enrollment (requires authentication)
router.post('/totp/enroll', mfaController.enrollTOTP.bind(mfaController));
router.post('/totp/verify-enrollment', mfaController.verifyTOTPEnrollment.bind(mfaController));

// MFA verification during login (no authentication required, uses MFA token)
router.post('/verify', mfaController.verifyMFA.bind(mfaController));

// Send SMS/Email codes (uses MFA token)
router.post('/sms/send', mfaController.sendSMSCode.bind(mfaController));
router.post('/email/send', mfaController.sendEmailCode.bind(mfaController));

// Disable MFA (requires authentication)
router.post('/disable', mfaController.disableMFA.bind(mfaController));

export default router;
