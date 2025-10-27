import { db, redis, logger } from '@auth/shared';

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  last4: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  description: string;
  dueDate: string;
  paidAt?: string;
  attemptCount: number;
  nextAttemptAt?: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  paymentMethodId: string;
  processorPaymentId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface AddPaymentMethodInput {
  type: 'card' | 'bank_account';
  token: string; // From payment processor client-side tokenization
  last4: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export class PaymentService {
  /**
   * Add payment method
   */
  async addPaymentMethod(userId: string, input: AddPaymentMethodInput): Promise<PaymentMethod> {
    const { type, token, last4, brand, expiryMonth, expiryYear } = input;

    // In production, this would call Stripe/PayPal API to create payment method
    // For now, we'll simulate it
    const processorId = `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if this is the first payment method
    const existingMethods = await db.query(
      'SELECT COUNT(*) as count FROM payment_methods WHERE user_id = $1',
      [userId]
    );

    const isFirst = parseInt(existingMethods.rows[0].count, 10) === 0;

    // Create payment method
    const result = await db.query(
      `INSERT INTO payment_methods 
       (user_id, type, processor_id, last4, brand, expiry_month, expiry_year, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, type, last4, brand, expiry_month, expiry_year, is_default, created_at, updated_at`,
      [userId, type, processorId, last4, brand || null, expiryMonth || null, expiryYear || null, isFirst]
    );

    const paymentMethod = this.mapPaymentMethodFromDb(result.rows[0]);

    logger.info('Payment method added', { userId, paymentMethodId: paymentMethod.id });

    return paymentMethod;
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    const result = await db.query(
      `SELECT id, type, last4, brand, expiry_month, expiry_year, is_default, created_at, updated_at
       FROM payment_methods
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => this.mapPaymentMethodFromDb(row));
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    // Verify payment method belongs to user
    const result = await db.query(
      'SELECT processor_id, is_default FROM payment_methods WHERE id = $1 AND user_id = $2',
      [paymentMethodId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Payment method not found');
    }

    const { processor_id, is_default } = result.rows[0];

    // Check if used in active subscription
    const activeSubscription = await db.query(
      `SELECT id FROM subscriptions 
       WHERE user_id = $1 AND payment_method_id = $2 AND status IN ('active', 'trialing')`,
      [userId, paymentMethodId]
    );

    if (activeSubscription.rows.length > 0) {
      throw new Error('Cannot delete payment method used in active subscription');
    }

    // In production, delete from payment processor
    logger.info('Deleting payment method from processor', { processorId: processor_id });

    // Delete from database
    await db.query('DELETE FROM payment_methods WHERE id = $1', [paymentMethodId]);

    // If this was the default, set another as default
    if (is_default) {
      const otherMethods = await db.query(
        'SELECT id FROM payment_methods WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (otherMethods.rows.length > 0) {
        await db.query('UPDATE payment_methods SET is_default = true WHERE id = $1', [
          otherMethods.rows[0].id,
        ]);
      }
    }

    logger.info('Payment method deleted', { userId, paymentMethodId });
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    // Verify payment method belongs to user
    const result = await db.query(
      'SELECT id FROM payment_methods WHERE id = $1 AND user_id = $2',
      [paymentMethodId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Payment method not found');
    }

    // Unset current default
    await db.query('UPDATE payment_methods SET is_default = false WHERE user_id = $1', [userId]);

    // Set new default
    await db.query('UPDATE payment_methods SET is_default = true WHERE id = $1', [paymentMethodId]);

    logger.info('Default payment method updated', { userId, paymentMethodId });
  }

  /**
   * Process payment
   */
  async processPayment(
    userId: string,
    invoiceId: string,
    paymentMethodId: string
  ): Promise<Payment> {
    // Get invoice details
    const invoiceResult = await db.query(
      'SELECT amount, currency, status FROM invoices WHERE id = $1 AND user_id = $2',
      [invoiceId, userId]
    );

    if (invoiceResult.rows.length === 0) {
      throw new Error('Invoice not found');
    }

    const invoice = invoiceResult.rows[0];

    if (invoice.status === 'paid') {
      throw new Error('Invoice already paid');
    }

    // Get payment method
    const paymentMethodResult = await db.query(
      'SELECT processor_id FROM payment_methods WHERE id = $1 AND user_id = $2',
      [paymentMethodId, userId]
    );

    if (paymentMethodResult.rows.length === 0) {
      throw new Error('Payment method not found');
    }

    // Create payment record
    const paymentResult = await db.query(
      `INSERT INTO payments (invoice_id, user_id, amount, currency, status, payment_method_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, invoice_id, amount, currency, status, payment_method_id, created_at, updated_at`,
      [invoiceId, userId, invoice.amount, invoice.currency, 'pending', paymentMethodId]
    );

    const payment = paymentResult.rows[0];

    try {
      // In production, charge via payment processor (Stripe/PayPal)
      // Simulating successful payment
      const processorPaymentId = `ch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Update payment status
      await db.query(
        `UPDATE payments 
         SET status = $1, processor_payment_id = $2, updated_at = NOW()
         WHERE id = $3`,
        ['succeeded', processorPaymentId, payment.id]
      );

      // Update invoice status
      await db.query(
        `UPDATE invoices 
         SET status = $1, paid_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        ['paid', invoiceId]
      );

      logger.info('Payment processed successfully', {
        userId,
        invoiceId,
        paymentId: payment.id,
        amount: invoice.amount,
      });

      // Create audit log
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address, user_agent, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, 'PAYMENT_SUCCESS', 'payment', payment.id, '0.0.0.0', 'system', 'success']
      );

      return {
        id: payment.id,
        invoiceId: payment.invoice_id,
        amount: parseFloat(payment.amount),
        currency: payment.currency,
        status: 'succeeded',
        paymentMethodId: payment.payment_method_id,
        processorPaymentId,
        createdAt: payment.created_at,
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      // Update payment status to failed
      await db.query(
        `UPDATE payments 
         SET status = $1, failure_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        ['failed', (error as Error).message, payment.id]
      );

      // Update invoice attempt count
      await db.query(
        `UPDATE invoices 
         SET attempt_count = attempt_count + 1, updated_at = NOW()
         WHERE id = $1`,
        [invoiceId]
      );

      logger.error('Payment processing failed', {
        userId,
        invoiceId,
        paymentId: payment.id,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Retry failed payments
   */
  async retryFailedPayments(): Promise<number> {
    // Find failed payments with attempt_count < 3
    const result = await db.query(
      `SELECT i.id, i.user_id, i.attempt_count, i.next_attempt_at, s.payment_method_id
       FROM invoices i
       JOIN subscriptions s ON i.subscription_id = s.id
       WHERE i.status = 'open'
       AND i.attempt_count < 3
       AND (i.next_attempt_at IS NULL OR i.next_attempt_at <= NOW())`
    );

    let retriedCount = 0;

    for (const invoice of result.rows) {
      try {
        // Calculate next attempt time (exponential backoff: 1 day, 3 days, 7 days)
        const daysToWait = invoice.attempt_count === 0 ? 1 : invoice.attempt_count === 1 ? 3 : 7;
        const nextAttempt = new Date();
        nextAttempt.setDate(nextAttempt.getDate() + daysToWait);

        // Update next attempt time
        await db.query('UPDATE invoices SET next_attempt_at = $1 WHERE id = $2', [
          nextAttempt,
          invoice.id,
        ]);

        // Retry payment
        await this.processPayment(invoice.user_id, invoice.id, invoice.payment_method_id);

        retriedCount++;
      } catch (error) {
        logger.error('Payment retry failed', {
          invoiceId: invoice.id,
          attemptCount: invoice.attempt_count + 1,
          error: (error as Error).message,
        });

        // If all retries exhausted, suspend subscription
        if (invoice.attempt_count >= 2) {
          await db.query(
            `UPDATE subscriptions 
             SET status = 'past_due', updated_at = NOW()
             WHERE user_id = $1`,
            [invoice.user_id]
          );

          logger.warn('Subscription suspended due to payment failure', {
            userId: invoice.user_id,
            invoiceId: invoice.id,
          });

          // TODO: Queue payment failure notification email
        }
      }
    }

    logger.info('Payment retry job completed', { retriedCount });

    return retriedCount;
  }

  /**
   * Get invoices
   */
  async getInvoices(userId: string, status?: string): Promise<Invoice[]> {
    let query = `
      SELECT id, number, amount, currency, status, description, due_date, paid_at,
             attempt_count, next_attempt_at, pdf_url, created_at, updated_at
      FROM invoices
      WHERE user_id = $1
    `;

    const params: any[] = [userId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);

    return result.rows.map((row) => this.mapInvoiceFromDb(row));
  }

  /**
   * Generate invoice
   */
  async generateInvoice(
    userId: string,
    subscriptionId: string,
    amount: number,
    currency: string,
    description: string
  ): Promise<Invoice> {
    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Calculate due date (7 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    // Create invoice
    const result = await db.query(
      `INSERT INTO invoices 
       (user_id, subscription_id, number, amount, currency, status, description, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, number, amount, currency, status, description, due_date, 
                 attempt_count, created_at, updated_at`,
      [userId, subscriptionId, invoiceNumber, amount, currency, 'open', description, dueDate]
    );

    const invoice = this.mapInvoiceFromDb(result.rows[0]);

    logger.info('Invoice generated', {
      userId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      amount,
    });

    // TODO: Generate PDF invoice
    // TODO: Queue invoice email

    return invoice;
  }

  /**
   * Handle webhook from payment processor
   */
  async handleWebhook(event: any): Promise<void> {
    // In production, verify webhook signature

    const eventType = event.type;
    const data = event.data;

    logger.info('Processing webhook', { eventType });

    switch (eventType) {
      case 'payment.succeeded':
        await this.handlePaymentSucceeded(data);
        break;

      case 'payment.failed':
        await this.handlePaymentFailed(data);
        break;

      case 'payment.refunded':
        await this.handlePaymentRefunded(data);
        break;

      default:
        logger.warn('Unhandled webhook event type', { eventType });
    }
  }

  /**
   * Handle payment succeeded webhook
   */
  private async handlePaymentSucceeded(data: any): Promise<void> {
    const processorPaymentId = data.id;

    // Find payment by processor ID
    const result = await db.query(
      'SELECT id, invoice_id FROM payments WHERE processor_payment_id = $1',
      [processorPaymentId]
    );

    if (result.rows.length === 0) {
      logger.warn('Payment not found for webhook', { processorPaymentId });
      return;
    }

    const { id, invoice_id } = result.rows[0];

    // Update payment status
    await db.query('UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2', [
      'succeeded',
      id,
    ]);

    // Update invoice status
    await db.query(
      'UPDATE invoices SET status = $1, paid_at = NOW(), updated_at = NOW() WHERE id = $2',
      ['paid', invoice_id]
    );

    logger.info('Payment succeeded via webhook', { paymentId: id, invoiceId: invoice_id });
  }

  /**
   * Handle payment failed webhook
   */
  private async handlePaymentFailed(data: any): Promise<void> {
    const processorPaymentId = data.id;
    const failureReason = data.failure_message || 'Payment failed';

    // Find payment by processor ID
    const result = await db.query(
      'SELECT id, invoice_id FROM payments WHERE processor_payment_id = $1',
      [processorPaymentId]
    );

    if (result.rows.length === 0) {
      logger.warn('Payment not found for webhook', { processorPaymentId });
      return;
    }

    const { id, invoice_id } = result.rows[0];

    // Update payment status
    await db.query(
      'UPDATE payments SET status = $1, failure_reason = $2, updated_at = NOW() WHERE id = $3',
      ['failed', failureReason, id]
    );

    // Update invoice attempt count
    await db.query(
      'UPDATE invoices SET attempt_count = attempt_count + 1, updated_at = NOW() WHERE id = $1',
      [invoice_id]
    );

    logger.info('Payment failed via webhook', { paymentId: id, invoiceId: invoice_id });
  }

  /**
   * Handle payment refunded webhook
   */
  private async handlePaymentRefunded(data: any): Promise<void> {
    const processorPaymentId = data.id;

    // Find payment by processor ID
    const result = await db.query(
      'SELECT id, invoice_id FROM payments WHERE processor_payment_id = $1',
      [processorPaymentId]
    );

    if (result.rows.length === 0) {
      logger.warn('Payment not found for webhook', { processorPaymentId });
      return;
    }

    const { id, invoice_id } = result.rows[0];

    // Update payment status
    await db.query('UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2', [
      'refunded',
      id,
    ]);

    // Update invoice status
    await db.query('UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2', [
      'void',
      invoice_id,
    ]);

    logger.info('Payment refunded via webhook', { paymentId: id, invoiceId: invoice_id });
  }

  /**
   * Map database row to PaymentMethod
   */
  private mapPaymentMethodFromDb(row: any): PaymentMethod {
    return {
      id: row.id,
      type: row.type,
      last4: row.last4,
      brand: row.brand,
      expiryMonth: row.expiry_month,
      expiryYear: row.expiry_year,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to Invoice
   */
  private mapInvoiceFromDb(row: any): Invoice {
    return {
      id: row.id,
      number: row.number,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status,
      description: row.description,
      dueDate: row.due_date,
      paidAt: row.paid_at,
      attemptCount: row.attempt_count,
      nextAttemptAt: row.next_attempt_at,
      pdfUrl: row.pdf_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const paymentService = new PaymentService();
