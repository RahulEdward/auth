/**
 * Parse user agent string to extract device information
 */
export function parseUserAgent(userAgent: string): {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
} {
  const ua = userAgent.toLowerCase();

  // Parse browser
  let browser = 'Unknown';
  let browserVersion = '';

  if (ua.includes('edg/')) {
    browser = 'Edge';
    browserVersion = ua.match(/edg\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('chrome/')) {
    browser = 'Chrome';
    browserVersion = ua.match(/chrome\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('firefox/')) {
    browser = 'Firefox';
    browserVersion = ua.match(/firefox\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('safari/') && !ua.includes('chrome')) {
    browser = 'Safari';
    browserVersion = ua.match(/version\/([\d.]+)/)?.[1] || '';
  }

  // Parse OS
  let os = 'Unknown';
  let osVersion = '';

  if (ua.includes('windows')) {
    os = 'Windows';
    if (ua.includes('windows nt 10.0')) osVersion = '10';
    else if (ua.includes('windows nt 6.3')) osVersion = '8.1';
    else if (ua.includes('windows nt 6.2')) osVersion = '8';
    else if (ua.includes('windows nt 6.1')) osVersion = '7';
  } else if (ua.includes('mac os x')) {
    os = 'macOS';
    osVersion = ua.match(/mac os x ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
    osVersion = ua.match(/android ([\d.]+)/)?.[1] || '';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = ua.includes('ipad') ? 'iPadOS' : 'iOS';
    osVersion = ua.match(/os ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
  }

  // Parse device
  let device = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android')) {
    device = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'Tablet';
  }

  return {
    browser,
    browserVersion,
    os,
    osVersion,
    device,
  };
}

/**
 * Generate device fingerprint from user agent and IP
 */
export function generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
  const crypto = require('crypto');
  const data = `${userAgent}:${ipAddress}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}
