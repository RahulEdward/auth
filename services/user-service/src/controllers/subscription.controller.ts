import { Request, Response, NextFunction } from 'express';
import { logger } from '@auth/shared';
import { subscriptionService } from '../services/subscription.service';

export class SubscriptionController {
  /**
   * GET /subscriptions/plans
   * Get all subscription plans
   */
  async getPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const interval = req.query.interval as 'month' | 'year' | undefined;

      const plans = await subscriptionService.getPlans(interval);

      res.status(200).json({ plans });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /subscriptions/plans/:planId
   * Get plan by ID
   */
  async getPlanById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { planId } = req.params;

      const plan = await subscriptionService.getPlanById(planId);

      if (!plan) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Plan not found',
          },
        });
      }

      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /subscriptions/plans
   * Create subscription plan (admin only)
   */
  async createPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description, price, currency, interval, intervalCount, features, limits } =
        req.body;

      if (!name || !description || price === undefined || !currency || !interval || !limits) {
        throw new Error('Missing required fields');
      }

      const plan = await subscriptionService.createPlan({
        name,
        description,
        price,
        currency,
        interval,
        intervalCount,
        features: features || {},
        limits,
      });

      res.status(201).json(plan);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /subscriptions/plans/:planId
   * Update subscription plan (admin only)
   */
  async updatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { planId } = req.params;
      const { name, description, price, features, limits, isActive } = req.body;

      const plan = await subscriptionService.updatePlan(planId, {
        name,
        description,
        price,
        features,
        limits,
        isActive,
      });

      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /subscriptions/me
   * Get current user subscription
   */
  async getMySubscription(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const subscription = await subscriptionService.getUserSubscription(userId);

      if (!subscription) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'No active subscription found',
          },
        });
      }

      res.status(200).json(subscription);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /subscriptions/subscribe
   * Subscribe to a plan
   */
  async subscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const { planId, paymentMethodId } = req.body;

      if (!planId) {
        throw new Error('Plan ID is required');
      }

      const subscription = await subscriptionService.subscribe(userId, planId, paymentMethodId);

      res.status(201).json(subscription);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /subscriptions/change-plan
   * Change subscription plan
   */
  async changePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const { newPlanId, prorationBehavior } = req.body;

      if (!newPlanId) {
        throw new Error('New plan ID is required');
      }

      const subscription = await subscriptionService.changePlan(
        userId,
        newPlanId,
        prorationBehavior
      );

      res.status(200).json(subscription);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /subscriptions/cancel
   * Cancel subscription
   */
  async cancelSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      await subscriptionService.cancelSubscription(userId);

      res.status(200).json({
        message: 'Subscription will be canceled at the end of the current billing period',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /subscriptions/usage
   * Track usage (internal endpoint)
   */
  async trackUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const { metric, quantity } = req.body;

      if (!metric || quantity === undefined) {
        throw new Error('Metric and quantity are required');
      }

      await subscriptionService.trackUsage(userId, metric, quantity);

      res.status(200).json({
        message: 'Usage tracked successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /subscriptions/check-limits
   * Check if user has exceeded usage limits
   */
  async checkLimits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const withinLimits = await subscriptionService.checkUsageLimits(userId);

      res.status(200).json({
        withinLimits,
        message: withinLimits ? 'Usage within limits' : 'Usage limits exceeded',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const subscriptionController = new SubscriptionController();
