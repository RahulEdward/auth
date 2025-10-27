import request from 'supertest';
import app from '../index';
import { db, redis } from '@auth/shared';

describe('Subscription Integration Tests', () => {
  let adminToken: string;
  let userToken: string;
  let userId: string;
  let testPlanId: string;

  beforeAll(async () => {
    await db.connect();
    await redis.connect();

    userId = 'test-user-id';
    adminToken = 'mock-admin-jwt-token';
    userToken = 'mock-user-jwt-token';

    // Create test user
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, email_verified, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'test@example.com', 'Test User', 'hash', true, 'active']
    );
  });

  afterAll(async () => {
    // Clean up
    await db.query('DELETE FROM usage_records WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM subscription_plans WHERE is_active = false OR name LIKE $1', [
      'Test%',
    ]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    await db.disconnect();
    await redis.disconnect();
  });

  describe('POST /api/v1/subscriptions/plans', () => {
    it('should create a subscription plan', async () => {
      const response = await request(app)
        .post('/api/v1/subscriptions/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Plan',
          description: 'A test subscription plan',
          price: 29.99,
          currency: 'USD',
          interval: 'month',
          intervalCount: 1,
          features: {
            feature1: true,
            feature2: false,
          },
          limits: {
            apiCalls: 10000,
            storage: 1000,
            users: 5,
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Plan');
      expect(response.body.price).toBe(29.99);
      expect(response.body.interval).toBe('month');
      expect(response.body.limits.apiCalls).toBe(10000);

      testPlanId = response.body.id;
    });

    it('should reject plan creation with missing fields', async () => {
      await request(app)
        .post('/api/v1/subscriptions/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Incomplete Plan',
          description: 'Missing required fields',
        })
        .expect(500);
    });
  });

  describe('GET /api/v1/subscriptions/plans', () => {
    it('should return all active plans', async () => {
      const response = await request(app).get('/api/v1/subscriptions/plans').expect(200);

      expect(response.body.plans).toBeInstanceOf(Array);
      expect(response.body.plans.length).toBeGreaterThan(0);
      expect(response.body.plans[0]).toHaveProperty('id');
      expect(response.body.plans[0]).toHaveProperty('name');
      expect(response.body.plans[0]).toHaveProperty('price');
    });

    it('should filter plans by interval', async () => {
      const response = await request(app)
        .get('/api/v1/subscriptions/plans?interval=month')
        .expect(200);

      expect(response.body.plans).toBeInstanceOf(Array);
      response.body.plans.forEach((plan: any) => {
        expect(plan.interval).toBe('month');
      });
    });
  });

  describe('GET /api/v1/subscriptions/plans/:planId', () => {
    it('should return plan by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/subscriptions/plans/${testPlanId}`)
        .expect(200);

      expect(response.body.id).toBe(testPlanId);
      expect(response.body.name).toBe('Test Plan');
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app).get('/api/v1/subscriptions/plans/non-existent-id').expect(404);
    });
  });

  describe('PATCH /api/v1/subscriptions/plans/:planId', () => {
    it('should update plan', async () => {
      const response = await request(app)
        .patch(`/api/v1/subscriptions/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated description',
          price: 39.99,
        })
        .expect(200);

      expect(response.body.description).toBe('Updated description');
      expect(response.body.price).toBe(39.99);
    });

    it('should update plan limits', async () => {
      const response = await request(app)
        .patch(`/api/v1/subscriptions/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          limits: {
            apiCalls: 20000,
          },
        })
        .expect(200);

      expect(response.body.limits.apiCalls).toBe(20000);
      expect(response.body.limits.storage).toBe(1000); // Should preserve other limits
    });
  });

  describe('POST /api/v1/subscriptions/subscribe', () => {
    it('should subscribe user to a plan', async () => {
      const response = await request(app)
        .post('/api/v1/subscriptions/subscribe')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          planId: testPlanId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.planId).toBe(testPlanId);
      expect(response.body.status).toBe('active');
      expect(response.body).toHaveProperty('currentPeriodStart');
      expect(response.body).toHaveProperty('currentPeriodEnd');
    });

    it('should reject duplicate subscription', async () => {
      await request(app)
        .post('/api/v1/subscriptions/subscribe')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          planId: testPlanId,
        })
        .expect(500);
    });

    it('should reject subscription to non-existent plan', async () => {
      // Create another user
      const newUserId = 'new-user-id';
      await db.query(
        `INSERT INTO users (id, email, name, password_hash, email_verified, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newUserId, 'new@example.com', 'New User', 'hash', true, 'active']
      );

      await request(app)
        .post('/api/v1/subscriptions/subscribe')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          planId: 'non-existent-plan-id',
        })
        .expect(500);

      // Clean up
      await db.query('DELETE FROM users WHERE id = $1', [newUserId]);
    });
  });

  describe('GET /api/v1/subscriptions/me', () => {
    it('should return user subscription', async () => {
      const response = await request(app)
        .get('/api/v1/subscriptions/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.planId).toBe(testPlanId);
      expect(response.body.status).toBe('active');
      expect(response.body).toHaveProperty('usage');
      expect(response.body.usage).toHaveProperty('apiCalls');
      expect(response.body.usage).toHaveProperty('storage');
      expect(response.body.usage).toHaveProperty('users');
    });
  });

  describe('POST /api/v1/subscriptions/usage', () => {
    it('should track API call usage', async () => {
      const response = await request(app)
        .post('/api/v1/subscriptions/usage')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          metric: 'apiCalls',
          quantity: 100,
        })
        .expect(200);

      expect(response.body.message).toBe('Usage tracked successfully');

      // Verify usage was recorded
      const subscription = await request(app)
        .get('/api/v1/subscriptions/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(subscription.body.usage.apiCalls).toBe(100);
    });

    it('should track storage usage', async () => {
      await request(app)
        .post('/api/v1/subscriptions/usage')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          metric: 'storage',
          quantity: 50,
        })
        .expect(200);

      const subscription = await request(app)
        .get('/api/v1/subscriptions/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(subscription.body.usage.storage).toBe(50);
    });
  });

  describe('GET /api/v1/subscriptions/check-limits', () => {
    it('should return within limits when usage is low', async () => {
      const response = await request(app)
        .get('/api/v1/subscriptions/check-limits')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.withinLimits).toBe(true);
    });

    it('should return exceeded when usage is over limit', async () => {
      // Track usage that exceeds limit
      await request(app)
        .post('/api/v1/subscriptions/usage')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          metric: 'apiCalls',
          quantity: 25000, // Exceeds 20000 limit
        })
        .expect(200);

      const response = await request(app)
        .get('/api/v1/subscriptions/check-limits')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.withinLimits).toBe(false);
    });
  });

  describe('POST /api/v1/subscriptions/change-plan', () => {
    it('should change subscription plan', async () => {
      // Create another plan
      const newPlan = await request(app)
        .post('/api/v1/subscriptions/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Premium Plan',
          description: 'Premium subscription',
          price: 99.99,
          currency: 'USD',
          interval: 'month',
          limits: {
            apiCalls: 100000,
            storage: 10000,
            users: 50,
          },
        })
        .expect(201);

      const response = await request(app)
        .post('/api/v1/subscriptions/change-plan')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          newPlanId: newPlan.body.id,
          prorationBehavior: 'create_prorations',
        })
        .expect(200);

      expect(response.body.planId).toBe(newPlan.body.id);
    });
  });

  describe('POST /api/v1/subscriptions/cancel', () => {
    it('should cancel subscription', async () => {
      const response = await request(app)
        .post('/api/v1/subscriptions/cancel')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.message).toContain('canceled');

      // Verify subscription is marked for cancellation
      const subscription = await db.query(
        'SELECT cancel_at_period_end FROM subscriptions WHERE user_id = $1',
        [userId]
      );

      expect(subscription.rows[0].cancel_at_period_end).toBe(true);
    });
  });

  describe('Usage Caching', () => {
    it('should cache usage data', async () => {
      // Get subscription (should cache usage)
      await request(app)
        .get('/api/v1/subscriptions/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Check if cached
      const subscription = await db.query(
        'SELECT id FROM subscriptions WHERE user_id = $1',
        [userId]
      );

      const cacheKey = `usage:${userId}:${subscription.rows[0].id}`;
      const cached = await redis.get(cacheKey);

      expect(cached).not.toBeNull();
    });

    it('should invalidate cache when usage is tracked', async () => {
      const subscription = await db.query(
        'SELECT id FROM subscriptions WHERE user_id = $1',
        [userId]
      );

      const cacheKey = `usage:${userId}:${subscription.rows[0].id}`;

      // Track usage (should invalidate cache)
      await request(app)
        .post('/api/v1/subscriptions/usage')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          metric: 'apiCalls',
          quantity: 10,
        })
        .expect(200);

      // Check cache is cleared
      const cached = await redis.get(cacheKey);
      expect(cached).toBeNull();
    });
  });
});
