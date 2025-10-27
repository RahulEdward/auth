export interface EmailMessage {
  to: string | string[];
  subject: string;
  template: string;
  variables: Record<string, any>;
  attachments?: EmailAttachment[];
  priority?: 'high' | 'normal' | 'low';
}

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

export interface SmsMessage {
  to: string;
  message: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface NotificationJob {
  id: string;
  type: 'email' | 'sms';
  payload: EmailMessage | SmsMessage;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledFor?: Date;
}

export interface DeliveryStatus {
  id: string;
  type: 'email' | 'sms';
  recipient: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  provider: string;
  providerId?: string;
  error?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}
