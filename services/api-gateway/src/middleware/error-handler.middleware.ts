import { Request, Response, NextFunction } from 'express';
import { logger, AppError, errorToResponse } from '@auth/shared';
import { getTraceId, getRequestId } from './tracing.middleware';

export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const traceId = getTraceId(req);
  const requestId = getRequestId(req);

  // Log error
  logger.error('Request error', {
    traceId,
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle known application errors
  if (err instanceof AppError) {
    const response = errorToResponse(err);
    const statusCode = (err as any).statusCode || 500;
    res.status(statusCode).json({
      error: {
        code: response.error.code,
        message: response.error.message,
        traceId,
        requestId,
      },
    });
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      traceId,
      requestId,
    },
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response
): void => {
  const traceId = getTraceId(req);
  const requestId = getRequestId(req);
  
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      traceId,
      requestId,
    },
  });
};
