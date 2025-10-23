import express from 'express';
import { logger } from '@auth/shared';
import userRoutes from './routes/user.routes';

const app = express();
const PORT = process.env.USER_SERVICE_PORT || 3002;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (avatars and exports)
app.use('/uploads', express.static('uploads'));
app.use('/exports', express.static('exports'));

// Routes
app.use('/api/v1/users', userRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'user-service' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('User service error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: {
      message: err.message || 'Internal server error',
    },
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`User service listening on port ${PORT}`);
});

export default app;
