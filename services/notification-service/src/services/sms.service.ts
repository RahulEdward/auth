import { Twilio } from 'twilio';
import { smsConfig } from '../config/sms.config';
import { SmsMessage, DeliveryStatus } from '../types/notification.types';
import { logger } from '@auth/shared';

export class SmsService {
  private twilioClient?: Twilio;

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    if (smsConfig.provider === 'twilio') {
      if (smsConfig.twilio?.accountSid && smsConfig.twilio?.authToken) {
        this.twilioClient = new Twilio(
          smsConfig.twilio.accountSid,
          smsConfig.twilio.authToken
        );
      } else {
        logger.warn('Twilio credentials not configured');
      }
    } else {
      logger.warn(`SMS provider ${smsConfig.provider} not fully implemented`);
    }
  }

  async sendSms(message: SmsMessage): Promise<DeliveryStatus> {
    const deliveryStatus: DeliveryStatus = {
      id: this.generateId(),
      type: 'sms',
      recipient: message.to,
      status: 'pending',
      provider: smsConfig.provider,
      createdAt: new Date(),
    };

    try {
      if (!this.twilioClient) {
        throw new Error('SMS provider not initialized');
      }

      const result = await this.twilioClient.messages.create({
        body: message.message,
        from: smsConfig.twilio!.fromNumber,
        to: message.to,
      });

      deliveryStatus.status = result.status === 'sent' || result.status === 'queued' ? 'sent' : 'failed';
      deliveryStatus.providerId = result.sid;
      deliveryStatus.sentAt = new Date();

      logger.info('SMS sent successfully', {
        messageId: result.sid,
        recipient: deliveryStatus.recipient,
        status: result.status,
      });

      return deliveryStatus;
    } catch (error) {
      deliveryStatus.status = 'failed';
      deliveryStatus.error = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to send SMS', {
        error: deliveryStatus.error,
        recipient: deliveryStatus.recipient,
      });

      throw error;
    }
  }

  private generateId(): string {
    return `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
