import express from 'express';
import { logger } from '@auth/shared';
import { QueueService } from './services/queue.service';
import { EmailService } from './services/email.service';
import notificationRoutes from './routes/notification.routes';

const app = express();
app.use(express.json());

const queueService = new QueueService();
const emailService = new EmailService();

// Routes
app.use('/api/v1/notifications', notificationRoutes);

// Health check endpoints
app.get('/health/live', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

app.get('/health/ready', async (_req, res) => {
  try {
    const emailReady = await emailService.verifyConnection();
    res.json({
      status: emailReady ? 'ready' : 'not ready',
      service: 'notification-service',
      email: emailReady,
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      service: 'notification-service',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

async function start() {
  try {
    // Connect to message queue
    await queueService.connect();

    // Start consuming messages
    await queueService.startConsumer();

    // Verify email connection
    await emailService.verifyConnection();

    const port = process.env.NOTIFICATION_SERVICE_PORT || 3004;
    app.listen(port, () => {
      logger.info(`Notification service listening on port ${port}`);
    });
  } catch (error) {
    logger.error('Failed to start notification service', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await queueService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await queueService.close();
  process.exit(0);
});

start();
