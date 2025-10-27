import { db, redis, logger } from '@auth/shared';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  intervalCount: number;
  features: Record<string, boolean>;
  limits: {
    apiCalls: number;
    storage: number;
    users: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserSubscription {
  id: string;
  planId: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  trialStart?: string;
  trialEnd?: string;
  usage: {
    apiCalls: number;
    storage: number;
    users: number;
  };
}

interface CreatePlanInput {
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  intervalCount?: number;
  features: Record<string, boolean>;
  limits: {
    apiCalls: number;
    storage: number;
    users: number;
  };
}

interface UpdatePlanInput {
  name?: string;
  description?: string;
  price?: number;
  features?: Record<string, boolean>;
  limits?: {
    apiCalls?: number;
    storage?: number;
    users?: number;
  };
  isActive?: boolean;
}

export class SubscriptionService {
  /**
   * Get all subscription plans
   */
  async getPlans(interval?: 'month' | 'year'): Promise<SubscriptionPlan[]> {
    let query = `
      SELECT id, name, description, price, currency, interval, interval_count,
             features, limits, is_active, created_at, updated_at
      FROM subscription_plans
      WHERE is_active = true
    `;

    const params: any[] = [];

    if (interval) {
      query += ' AND interval = $1';
      params.push(interval);
    }

    query += ' ORDER BY price ASC';

    const result = await db.query(query, params);

    return result.rows.map((row) => this.mapPlanFromDb(row));
  }

  /**
   * Get plan by ID
   */
  async getPlanById(planId: string): Promise<SubscriptionPlan | null> {
    const result = await db.query(
      `SELECT id, name, description, price, currency, interval, interval_count,
              features, limits, is_active, created_at, updated_at
       FROM subscription_plans
       WHERE id = $1`,
      [planId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapPlanFromDb(result.rows[0]);
  }

  /**
   * Create subscription plan (admin only)
   */
  async createPlan(input: CreatePlanInput): Promise<SubscriptionPlan> {
    const {
      name,
      description,
      price,
      currency,
      interval,
      intervalCount = 1,
      features,
      limits,
    } = input;

    const result = await db.query(
      `INSERT INTO subscription_plans 
       (name, description, price, currency, interval, interval_count, features, limits, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, description, price, currency, interval, interval_count,
                 features, limits, is_active, created_at, updated_at`,
      [name, description, price, currency, interval, intervalCount, JSON.stringify(features), JSON.stringify(limits), true]
    );

    const plan = this.mapPlanFromDb(result.rows[0]);

    logger.info('Subscription plan created', { planId: plan.id, name: plan.name });

    return plan;
  }

  /**
   * Update subscription plan (admin only)
   */
  async updatePlan(planId: string, input: UpdatePlanInput): Promise<SubscriptionPlan> {
    const plan = await this.getPlanById(planId);

    if (!plan) {
      throw new Error('Plan not found');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }

    if (input.price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      values.push(input.price);
    }

    if (input.features !== undefined) {
      updates.push(`features = $${paramIndex++}`);
      values.push(JSON.stringify(input.features));
    }

    if (input.limits !== undefined) {
      const mergedLimits = { ...plan.limits, ...input.limits };
      updates.push(`limits = $${paramIndex++}`);
      values.push(JSON.stringify(mergedLimits));
    }

    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.isActive);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(planId);

    const query = `
      UPDATE subscription_plans
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, description, price, currency, interval, interval_count,
                features, limits, is_active, created_at, updated_at
    `;

    const result = await db.query(query, values);

    logger.info('Subscription plan updated', { planId });

    return this.mapPlanFromDb(result.rows[0]);
  }

  /**
   * Get user subscription
   */
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    const result = await db.query(
      `SELECT id, plan_id, status, current_period_start, current_period_end,
              cancel_at_period_end, canceled_at, trial_start, trial_end
       FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const subscription = result.rows[0];

    // Get current usage
    const usage = await this.getCurrentUsage(userId, subscription.id);

    return {
      id: subscription.id,
      planId: subscription.plan_id,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at,
      trialStart: subscription.trial_start,
      trialEnd: subscription.trial_end,
      usage,
    };
  }

  /**
   * Subscribe user to a plan
   */
  async subscribe(
    userId: string,
    planId: string,
    paymentMethodId?: string
  ): Promise<UserSubscription> {
    // Verify plan exists
    const plan = await this.getPlanById(planId);

    if (!plan) {
      throw new Error('Plan not found');
    }

    if (!plan.isActive) {
      throw new Error('Plan is not active');
    }

    // Check if user already has an active subscription
    const existingSubscription = await this.getUserSubscription(userId);

    if (existingSubscription) {
      throw new Error('User already has an active subscription');
    }

    // Calculate period dates
    const now = new Date();
    const periodEnd = new Date(now);

    if (plan.interval === 'month') {
      periodEnd.setMonth(periodEnd.getMonth() + plan.intervalCount);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + plan.intervalCount);
    }

    // Create subscription
    const result = await db.query(
      `INSERT INTO subscriptions 
       (user_id, plan_id, status, current_period_start, current_period_end, payment_method_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, plan_id, status, current_period_start, current_period_end,
                 cancel_at_period_end, canceled_at, trial_start, trial_end`,
      [userId, planId, 'active', now, periodEnd, paymentMethodId || null]
    );

    const subscription = result.rows[0];

    logger.info('User subscribed to plan', { userId, planId, subscriptionId: subscription.id });

    // TODO: Create initial invoice and trigger payment

    return {
      id: subscription.id,
      planId: subscription.plan_id,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at,
      trialStart: subscription.trial_start,
      trialEnd: subscription.trial_end,
      usage: {
        apiCalls: 0,
        storage: 0,
        users: 0,
      },
    };
  }

  /**
   * Change subscription plan
   */
  async changePlan(
    userId: string,
    newPlanId: string,
    prorationBehavior: 'create_prorations' | 'none' = 'create_prorations'
  ): Promise<UserSubscription> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    const newPlan = await this.getPlanById(newPlanId);

    if (!newPlan) {
      throw new Error('New plan not found');
    }

    if (!newPlan.isActive) {
      throw new Error('New plan is not active');
    }

    // Update subscription
    await db.query(
      `UPDATE subscriptions
       SET plan_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [newPlanId, subscription.id]
    );

    logger.info('Subscription plan changed', {
      userId,
      subscriptionId: subscription.id,
      oldPlanId: subscription.planId,
      newPlanId,
    });

    // TODO: Calculate proration if needed
    if (prorationBehavior === 'create_prorations') {
      // Create proration invoice
      logger.info('Proration invoice needed', { subscriptionId: subscription.id });
    }

    return this.getUserSubscription(userId) as Promise<UserSubscription>;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<void> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Mark for cancellation at period end
    await db.query(
      `UPDATE subscriptions
       SET cancel_at_period_end = true, canceled_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [subscription.id]
    );

    logger.info('Subscription canceled', { userId, subscriptionId: subscription.id });

    // TODO: Queue cancellation confirmation email
  }

  /**
   * Track usage
   */
  async trackUsage(
    userId: string,
    metric: 'apiCalls' | 'storage' | 'users',
    quantity: number
  ): Promise<void> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Record usage
    await db.query(
      `INSERT INTO usage_records (user_id, subscription_id, metric, quantity)
       VALUES ($1, $2, $3, $4)`,
      [userId, subscription.id, metric, quantity]
    );

    // Update cache
    const cacheKey = `usage:${userId}:${subscription.id}`;
    await redis.del(cacheKey);

    logger.debug('Usage tracked', { userId, metric, quantity });
  }

  /**
   * Check if usage exceeds limits
   */
  async checkUsageLimits(userId: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      return true; // No subscription, no limits
    }

    const plan = await this.getPlanById(subscription.planId);

    if (!plan) {
      return true;
    }

    const usage = subscription.usage;

    // Check each limit
    if (usage.apiCalls >= plan.limits.apiCalls) {
      logger.warn('API call limit exceeded', { userId, usage: usage.apiCalls, limit: plan.limits.apiCalls });
      return false;
    }

    if (usage.storage >= plan.limits.storage) {
      logger.warn('Storage limit exceeded', { userId, usage: usage.storage, limit: plan.limits.storage });
      return false;
    }

    if (usage.users >= plan.limits.users) {
      logger.warn('User limit exceeded', { userId, usage: usage.users, limit: plan.limits.users });
      return false;
    }

    return true;
  }

  /**
   * Get current usage for subscription
   */
  private async getCurrentUsage(
    userId: string,
    subscriptionId: string
  ): Promise<{ apiCalls: number; storage: number; users: number }> {
    // Check cache first
    const cacheKey = `usage:${userId}:${subscriptionId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Get usage from database (current period only)
    const subscription = await db.query(
      'SELECT current_period_start FROM subscriptions WHERE id = $1',
      [subscriptionId]
    );

    if (subscription.rows.length === 0) {
      return { apiCalls: 0, storage: 0, users: 0 };
    }

    const periodStart = subscription.rows[0].current_period_start;

    const result = await db.query(
      `SELECT metric, SUM(quantity) as total
       FROM usage_records
       WHERE user_id = $1 AND subscription_id = $2 AND timestamp >= $3
       GROUP BY metric`,
      [userId, subscriptionId, periodStart]
    );

    const usage = {
      apiCalls: 0,
      storage: 0,
      users: 0,
    };

    for (const row of result.rows) {
      if (row.metric === 'apiCalls') {
        usage.apiCalls = parseInt(row.total, 10);
      } else if (row.metric === 'storage') {
        usage.storage = parseInt(row.total, 10);
      } else if (row.metric === 'users') {
        usage.users = parseInt(row.total, 10);
      }
    }

    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(usage), 5 * 60);

    return usage;
  }

  /**
   * Renew subscriptions (background job)
   */
  async renewSubscriptions(): Promise<number> {
    // Find subscriptions ending in next 24 hours
    const result = await db.query(
      `SELECT id, user_id, plan_id
       FROM subscriptions
       WHERE status = 'active'
       AND current_period_end <= NOW() + INTERVAL '24 hours'
       AND current_period_end > NOW()
       AND cancel_at_period_end = false`
    );

    let renewedCount = 0;

    for (const subscription of result.rows) {
      try {
        // Get plan details
        const plan = await this.getPlanById(subscription.plan_id);

        if (!plan) {
          logger.error('Plan not found for subscription', { subscriptionId: subscription.id });
          continue;
        }

        // Calculate new period
        const newPeriodStart = new Date();
        const newPeriodEnd = new Date(newPeriodStart);

        if (plan.interval === 'month') {
          newPeriodEnd.setMonth(newPeriodEnd.getMonth() + plan.intervalCount);
        } else {
          newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + plan.intervalCount);
        }

        // Update subscription
        await db.query(
          `UPDATE subscriptions
           SET current_period_start = $1, current_period_end = $2, updated_at = NOW()
           WHERE id = $3`,
          [newPeriodStart, newPeriodEnd, subscription.id]
        );

        logger.info('Subscription renewed', {
          subscriptionId: subscription.id,
          userId: subscription.user_id,
        });

        // TODO: Create renewal invoice and trigger payment

        renewedCount++;
      } catch (error) {
        logger.error('Failed to renew subscription', {
          subscriptionId: subscription.id,
          error: (error as Error).message,
        });
      }
    }

    logger.info('Subscription renewal job completed', { renewedCount });

    return renewedCount;
  }

  /**
   * Map database row to SubscriptionPlan
   */
  private mapPlanFromDb(row: any): SubscriptionPlan {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price),
      currency: row.currency,
      interval: row.interval,
      intervalCount: row.interval_count,
      features: typeof row.features === 'string' ? JSON.parse(row.features) : row.features,
      limits: typeof row.limits === 'string' ? JSON.parse(row.limits) : row.limits,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const subscriptionService = new SubscriptionService();
