import { Request, Response, NextFunction } from 'express';
import { logger } from '@auth/shared';
import { paymentService } from '../services/payment.service';

export class PaymentController {
  /**
   * POST /payments/methods
   * Add payment method
   */
  async addPaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const { type, token, last4, brand, expiryMonth, expiryYear } = req.body;

      if (!type || !token || !last4) {
        throw new Error('Type, token, and last4 are required');
      }

      const paymentMethod = await paymentService.addPaymentMethod(userId, {
        type,
        token,
        last4,
        brand,
        expiryMonth,
        expiryYear,
      });

      res.status(201).json(paymentMethod);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /payments/methods
   * Get payment methods
   */
  async getPaymentMethods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const methods = await paymentService.getPaymentMethods(userId);

      res.status(200).json({ methods });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /payments/methods/:methodId
   * Delete payment method
   */
  async deletePaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const { methodId } = req.params;

      await paymentService.deletePaymentMethod(userId, methodId);

      res.status(200).json({
        message: 'Payment method deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /payments/methods/:methodId/set-default
   * Set default payment method
   */
  async setDefaultPaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const { methodId } = req.params;

      await paymentService.setDefaultPaymentMethod(userId, methodId);

      res.status(200).json({
        message: 'Default payment method updated',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /payments/invoices
   * Get invoices
   */
  async getInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const status = req.query.status as string | undefined;

      const invoices = await paymentService.getInvoices(userId, status);

      res.status(200).json({ invoices });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /payments/process
   * Process payment (internal)
   */
  async processPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw new Error('Authentication required');
      }

      const { invoiceId, paymentMethodId } = req.body;

      if (!invoiceId || !paymentMethodId) {
        throw new Error('Invoice ID and payment method ID are required');
      }

      const payment = await paymentService.processPayment(userId, invoiceId, paymentMethodId);

      res.status(200).json(payment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /payments/webhooks
   * Handle payment processor webhooks
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const event = req.body;

      // In production, verify webhook signature here
      const signature = req.headers['stripe-signature'] || req.headers['x-webhook-signature'];

      if (!signature) {
        throw new Error('Missing webhook signature');
      }

      await paymentService.handleWebhook(event);

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Webhook processing failed', { error: (error as Error).message });
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
