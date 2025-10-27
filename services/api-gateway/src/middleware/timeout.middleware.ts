import { Request, Response, NextFunction } from 'express';

export const timeoutMiddleware = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Set timeout for the request
    req.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(408).json({
          error: {
            code: 'REQUEST_TIMEOUT',
            message: 'Request timeout',
            timeout: `${timeoutMs}ms`,
          },
        });
      }
    });

    // Set timeout for the response
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(504).json({
          error: {
            code: 'GATEWAY_TIMEOUT',
            message: 'Gateway timeout',
            timeout: `${timeoutMs}ms`,
          },
        });
      }
    });

    next();
  };
};
