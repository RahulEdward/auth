import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { config, logger, db, redis } from '@auth/shared';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check endpoints
app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (_req, res) => {
  const dbHealthy = await db.healthCheck();
  const redisHealthy = await redis.healthCheck();
  
  if (dbHealthy && redisHealthy) {
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      redis: 'connected',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      database: dbHealthy ? 'connected' : 'disconnected',
      redis: redisHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// API routes will be added here
app.get('/api/v1', (_req, res) => {
  res.json({
    message: 'Enterprise Auth System API',
    version: '1.0.0',
    endpoints: {
      health: '/health/live',
      ready: '/health/ready',
    },
  });
});

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    },
  });
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to database and redis
    await db.connect();
    await redis.connect();
    
    const port = config.port;
    app.listen(port, () => {
      logger.info(`API Gateway listening on port ${port}`);
      logger.info(`Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
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
