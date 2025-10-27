import { Request, Response, NextFunction } from 'express';
import { generateRandomToken } from '@auth/shared';

export const TRACE_ID_HEADER = 'x-trace-id';
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Middleware to generate and propagate trace IDs
 */
export const tracingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate or extract trace ID
  let traceId = req.get(TRACE_ID_HEADER);
  
  if (!traceId) {
    traceId = `trace_${Date.now()}_${generateRandomToken(16)}`;
  }

  // Generate request ID
  const requestId = `req_${Date.now()}_${generateRandomToken(12)}`;

  // Attach to request object
  (req as any).traceId = traceId;
  (req as any).requestId = requestId;

  // Set response headers for client
  res.setHeader(TRACE_ID_HEADER, traceId);
  res.setHeader(REQUEST_ID_HEADER, requestId);

  // Add to response locals for use in other middleware
  res.locals.traceId = traceId;
  res.locals.requestId = requestId;

  next();
};

/**
 * Get trace ID from request
 */
export const getTraceId = (req: Request): string => {
  return (req as any).traceId || 'unknown';
};

/**
 * Get request ID from request
 */
export const getRequestId = (req: Request): string => {
  return (req as any).requestId || 'unknown';
};

/**
 * Create headers object for downstream service calls
 */
export const getTracingHeaders = (req: Request): Record<string, string> => {
  const traceId = getTraceId(req);
  const requestId = getRequestId(req);

  return {
    [TRACE_ID_HEADER]: traceId,
    [REQUEST_ID_HEADER]: requestId,
  };
};
