export interface SmsConfig {
  provider: 'twilio' | 'sns';
  twilio?: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
  sns?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export const smsConfig: SmsConfig = {
  provider: (process.env.SMS_PROVIDER as any) || 'twilio',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
  },
  sns: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
};
