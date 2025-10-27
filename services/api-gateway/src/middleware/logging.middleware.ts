import { Request, Response, NextFunction } from 'express';
import { logger } from '@auth/shared';
import { getTraceId, getRequestId } from './tracing.middleware';

export const requestLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  const traceId = getTraceId(req);
  const requestId = getRequestId(req);

  // Log request
  logger.info('Incoming request', {
    traceId,
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      traceId,
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
};
