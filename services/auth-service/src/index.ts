import express, { Request, Response, NextFunction } from 'express';

import {
  config,
  logger,
  db,
  redis,
  errorToResponse,
  getStatusCode,
  isOperationalError,
} from '@auth/shared';

import authRoutes from './routes/auth.routes';

const app = express();

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'auth-service' });
});

// API routes
app.use('/api/v1/auth', authRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;

  // Log error
  if (isOperationalError(err)) {
    logger.warn('Operational error', {
      error: err.message,
      requestId,
      path: req.path,
    });
  } else {
    logger.error('Unexpected error', {
      error: err.message,
      stack: err.stack,
      requestId,
      path: req.path,
    });
  }

  // Send error response
  const statusCode = getStatusCode(err);
  const errorResponse = errorToResponse(err, requestId);

  res.status(statusCode).json(errorResponse);
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to database and redis
    await db.connect();
    await redis.connect();

    const port = process.env.AUTH_SERVICE_PORT || 3001;
    app.listen(port, () => {
      logger.info(`Auth Service listening on port ${port}`);
      logger.info(`Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error('Failed to start Auth Service', { error });
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.disconnect();
  await redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.disconnect();
  await redis.disconnect();
  process.exit(0);
});

startServer().catch((error) => {
  logger.error('Failed to start application', { error });
  process.exit(1);
});
