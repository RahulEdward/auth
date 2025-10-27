import request from 'supertest';
import app from '../index';
import { db, redis } from '@auth/shared';

describe('Payment Integration Tests', () => {
  let userToken: string;
  let userId: string;
  let testPlanId: string;
  let subscriptionId: string;
  let paymentMethodId: string;
  let invoiceId: string;

  beforeAll(async () => {
    await db.connect();
    await redis.connect();

    userId = 'test-user-id';
    userToken = 'mock-user-jwt-token';

    // Create test user
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, email_verified, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'test@example.com', 'Test User', 'hash', true, 'active']
    );

    // Create test plan
    const plan = await db.query(
      `INSERT INTO subscription_plans (name, description, price, currency, interval, limits, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      ['Test Plan', 'Test', 29.99, 'USD', 'month', JSON.stringify({ apiCalls: 10000, storage: 1000, users: 5 }), true]
    );

    testPlanId = plan.rows[0].id;

    // Create test subscription
    const subscription = await db.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '30 days')
       RETURNING id`,
      [userId, testPlanId, 'active']
    );

    subscriptionId = subscription.rows[0].id;
  });

  afterAll(async () => {
    // Clean up
    await db.query('DELETE FROM payments WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM invoices WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM payment_methods WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM subscription_plans WHERE id = $1', [testPlanId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    await db.disconnect();
    await redis.disconnect();
  });

  describe('POST /api/v1/payments/methods', () => {
    it('should add a payment method', async () => {
      const response = await request(app)
        .post('/api/v1/payments/methods')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'card',
          token: 'tok_visa',
          last4: '4242',
          brand: 'Visa',
          expiryMonth: 12,
          expiryYear: 2025,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('card');
      expect(response.body.last4).toBe('4242');
      expect(response.body.brand).toBe('Visa');
      expect(response.body.isDefault).toBe(true); // First payment method

      paymentMethodId = response.body.id;
    });

    it('should reject payment method with missing fields', async () => {
      await request(app)
        .post('/api/v1/payments/methods')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'card',
        })
        .expect(500);
    });
  });

  describe('GET /api/v1/payments/methods', () => {
    it('should return all payment methods', async () => {
      const response = await request(app)
        .get('/api/v1/payments/methods')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.methods).toBeInstanceOf(Array);
      expect(response.body.methods.length).toBeGreaterThan(0);
      expect(response.body.methods[0]).toHaveProperty('id');
      expect(response.body.methods[0]).toHaveProperty('last4');
      expect(response.body.methods[0]).toHaveProperty('isDefault');
    });

    it('should order by default first', async () => {
      // Add another payment method
      await request(app)
        .post('/api/v1/payments/methods')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'card',
          token: 'tok_mastercard',
          last4: '5555',
          brand: 'Mastercard',
          expiryMonth: 6,
          expiryYear: 2026,
        })
        .expect(201);

      const response = await request(app)
        .get('/api/v1/payments/methods')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.methods[0].isDefault).toBe(true);
    });
  });

  describe('POST /api/v1/payments/methods/:methodId/set-default', () => {
    it('should set default payment method', async () => {
      // Get non-default method
      const methods = await request(app)
        .get('/api/v1/payments/methods')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const nonDefaultMethod = methods.body.methods.find((m: any) => !m.isDefault);

      if (nonDefaultMethod) {
        await request(app)
          .post(`/api/v1/payments/methods/${nonDefaultMethod.id}/set-default`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        // Verify it's now default
        const updated = await request(app)
          .get('/api/v1/payments/methods')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        const nowDefault = updated.body.methods.find((m: any) => m.id === nonDefaultMethod.id);
        expect(nowDefault.isDefault).toBe(true);
      }
    });
  });

  describe('Invoice Generation and Payment', () => {
    it('should generate an invoice', async () => {
      // Manually create invoice for testing
      const invoice = await db.query(
        `INSERT INTO invoices (user_id, subscription_id, number, amount, currency, status, description, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days')
         RETURNING id`,
        [userId, subscriptionId, 'INV-TEST-001', 29.99, 'USD', 'open', 'Monthly subscription']
      );

      invoiceId = invoice.rows[0].id;
      expect(invoiceId).toBeDefined();
    });

    it('should process payment for invoice', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          invoiceId,
          paymentMethodId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('succeeded');
      expect(response.body.amount).toBe(29.99);
      expect(response.body.invoiceId).toBe(invoiceId);

      // Verify invoice is marked as paid
      const invoice = await db.query('SELECT status, paid_at FROM invoices WHERE id = $1', [
        invoiceId,
      ]);

      expect(invoice.rows[0].status).toBe('paid');
      expect(invoice.rows[0].paid_at).not.toBeNull();
    });

    it('should reject payment for already paid invoice', async () => {
      await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          invoiceId,
          paymentMethodId,
        })
        .expect(500);
    });
  });

  describe('GET /api/v1/payments/invoices', () => {
    it('should return all invoices', async () => {
      const response = await request(app)
        .get('/api/v1/payments/invoices')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.invoices).toBeInstanceOf(Array);
      expect(response.body.invoices.length).toBeGreaterThan(0);
      expect(response.body.invoices[0]).toHaveProperty('id');
      expect(response.body.invoices[0]).toHaveProperty('number');
      expect(response.body.invoices[0]).toHaveProperty('amount');
      expect(response.body.invoices[0]).toHaveProperty('status');
    });

    it('should filter invoices by status', async () => {
      const response = await request(app)
        .get('/api/v1/payments/invoices?status=paid')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.invoices).toBeInstanceOf(Array);
      response.body.invoices.forEach((invoice: any) => {
        expect(invoice.status).toBe('paid');
      });
    });
  });

  describe('DELETE /api/v1/payments/methods/:methodId', () => {
    it('should reject deleting payment method used in active subscription', async () => {
      // Update subscription to use this payment method
      await db.query('UPDATE subscriptions SET payment_method_id = $1 WHERE id = $2', [
        paymentMethodId,
        subscriptionId,
      ]);

      await request(app)
        .delete(`/api/v1/payments/methods/${paymentMethodId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(500);

      // Clean up
      await db.query('UPDATE subscriptions SET payment_method_id = NULL WHERE id = $1', [
        subscriptionId,
      ]);
    });

    it('should delete payment method not in use', async () => {
      // Get a non-default, unused method
      const methods = await request(app)
        .get('/api/v1/payments/methods')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const unusedMethod = methods.body.methods.find((m: any) => !m.isDefault);

      if (unusedMethod) {
        await request(app)
          .delete(`/api/v1/payments/methods/${unusedMethod.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        // Verify it's deleted
        const updated = await request(app)
          .get('/api/v1/payments/methods')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        const found = updated.body.methods.find((m: any) => m.id === unusedMethod.id);
        expect(found).toBeUndefined();
      }
    });
  });

  describe('POST /api/v1/payments/webhooks', () => {
    it('should handle payment succeeded webhook', async () => {
      // Create a pending payment
      const payment = await db.query(
        `INSERT INTO payments (invoice_id, user_id, amount, currency, status, payment_method_id, processor_payment_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [invoiceId, userId, 29.99, 'USD', 'pending', paymentMethodId, 'ch_test_123']
      );

      const response = await request(app)
        .post('/api/v1/payments/webhooks')
        .set('stripe-signature', 'test_signature')
        .send({
          type: 'payment.succeeded',
          data: {
            id: 'ch_test_123',
          },
        })
        .expect(200);

      expect(response.body.received).toBe(true);

      // Verify payment status updated
      const updated = await db.query('SELECT status FROM payments WHERE id = $1', [
        payment.rows[0].id,
      ]);

      expect(updated.rows[0].status).toBe('succeeded');
    });

    it('should handle payment failed webhook', async () => {
      // Create another pending payment
      const payment = await db.query(
        `INSERT INTO payments (invoice_id, user_id, amount, currency, status, payment_method_id, processor_payment_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [invoiceId, userId, 29.99, 'USD', 'pending', paymentMethodId, 'ch_test_456']
      );

      await request(app)
        .post('/api/v1/payments/webhooks')
        .set('stripe-signature', 'test_signature')
        .send({
          type: 'payment.failed',
          data: {
            id: 'ch_test_456',
            failure_message: 'Insufficient funds',
          },
        })
        .expect(200);

      // Verify payment status updated
      const updated = await db.query('SELECT status, failure_reason FROM payments WHERE id = $1', [
        payment.rows[0].id,
      ]);

      expect(updated.rows[0].status).toBe('failed');
      expect(updated.rows[0].failure_reason).toBe('Insufficient funds');
    });
  });
});
