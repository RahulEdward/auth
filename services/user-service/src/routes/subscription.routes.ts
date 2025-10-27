import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';

const router = Router();

// Public endpoints - subscription plans
router.get('/plans', subscriptionController.getPlans.bind(subscriptionController));
router.get('/plans/:planId', subscriptionController.getPlanById.bind(subscriptionController));

// Admin endpoints - plan management
router.post('/plans', subscriptionController.createPlan.bind(subscriptionController));
router.patch('/plans/:planId', subscriptionController.updatePlan.bind(subscriptionController));

// User subscription endpoints
router.get('/me', subscriptionController.getMySubscription.bind(subscriptionController));
router.post('/subscribe', subscriptionController.subscribe.bind(subscriptionController));
router.post('/change-plan', subscriptionController.changePlan.bind(subscriptionController));
router.post('/cancel', subscriptionController.cancelSubscription.bind(subscriptionController));

// Usage tracking
router.post('/usage', subscriptionController.trackUsage.bind(subscriptionController));
router.get('/check-limits', subscriptionController.checkLimits.bind(subscriptionController));

export default router;
