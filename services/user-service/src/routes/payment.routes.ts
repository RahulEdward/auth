import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';

const router = Router();

// Payment methods
router.post('/methods', paymentController.addPaymentMethod.bind(paymentController));
router.get('/methods', paymentController.getPaymentMethods.bind(paymentController));
router.delete('/methods/:methodId', paymentController.deletePaymentMethod.bind(paymentController));
router.post(
  '/methods/:methodId/set-default',
  paymentController.setDefaultPaymentMethod.bind(paymentController)
);

// Invoices
router.get('/invoices', paymentController.getInvoices.bind(paymentController));

// Payment processing
router.post('/process', paymentController.processPayment.bind(paymentController));

// Webhooks (public endpoint - no auth required)
router.post('/webhooks', paymentController.handleWebhook.bind(paymentController));

export default router;
