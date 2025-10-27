import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication and admin role
// These middleware should be applied at the gateway level or here

// User Management
router.get('/users', adminController.getAllUsers.bind(adminController));
router.get('/users/search', adminController.searchUsers.bind(adminController));
router.get('/users/:userId', adminController.getUserDetails.bind(adminController));
router.patch('/users/:userId/status', adminController.updateUserStatus.bind(adminController));
router.delete('/users/:userId', adminController.deleteUser.bind(adminController));
router.post('/users/:userId/impersonate', adminController.impersonateUser.bind(adminController));

// Metrics
router.get('/metrics', adminController.getMetrics.bind(adminController));
router.get('/metrics/user-growth', adminController.getUserGrowth.bind(adminController));
router.get('/metrics/auth-methods', adminController.getAuthMethodBreakdown.bind(adminController));
router.get('/metrics/subscriptions', adminController.getSubscriptionDistribution.bind(adminController));
router.get('/metrics/api-usage', adminController.getApiUsage.bind(adminController));

// Audit Logs
router.get('/audit-logs', adminController.getAuditLogs.bind(adminController));
router.get('/audit-logs/export', adminController.exportAuditLogs.bind(adminController));

export default router;
