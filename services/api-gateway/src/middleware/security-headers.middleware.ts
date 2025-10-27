import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to set security headers
 */
export const securityHeadersMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // HTTP Strict Transport Security (HSTS)
  // Tells browsers to only access the site over HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // X-Frame-Options
  // Prevents clickjacking attacks by not allowing the page to be embedded in frames
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options
  // Prevents MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection
  // Enables XSS filter built into most browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  // Controls how much referrer information is included with requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content-Security-Policy
  // Helps prevent XSS attacks by specifying which sources are allowed
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Adjust based on your needs
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);

  // Permissions-Policy (formerly Feature-Policy)
  // Controls which browser features can be used
  const permissionsPolicy = [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
  ].join(', ');
  
  res.setHeader('Permissions-Policy', permissionsPolicy);

  // X-Permitted-Cross-Domain-Policies
  // Restricts Adobe Flash and PDF cross-domain requests
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // X-Download-Options
  // Prevents Internet Explorer from executing downloads in the site's context
  res.setHeader('X-Download-Options', 'noopen');

  // Remove X-Powered-By header (if not already removed by helmet)
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * Middleware for API responses (less strict CSP)
 */
export const apiSecurityHeadersMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Remove X-Powered-By
  res.removeHeader('X-Powered-By');

  next();
};
