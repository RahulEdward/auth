export interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'ses' | 'mailgun';
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  sendgrid?: {
    apiKey: string;
  };
  ses?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  mailgun?: {
    apiKey: string;
    domain: string;
  };
  from: {
    name: string;
    email: string;
  };
  replyTo?: string;
}

export const emailConfig: EmailConfig = {
  provider: (process.env.EMAIL_PROVIDER as any) || 'smtp',
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
  },
  ses: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY || '',
    domain: process.env.MAILGUN_DOMAIN || '',
  },
  from: {
    name: process.env.EMAIL_FROM_NAME || 'Auth System',
    email: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
  },
  replyTo: process.env.EMAIL_REPLY_TO,
};
