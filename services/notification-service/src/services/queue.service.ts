import amqp, { Channel, ConsumeMessage } from 'amqplib';
import { logger } from '@auth/shared';
import { NotificationJob, EmailMessage, SmsMessage } from '../types/notification.types';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';

export class QueueService {
  private connection?: any;
  private channel?: Channel;
  private emailService: EmailService;
  private smsService: SmsService;
  private readonly queueName = 'notifications';
  private readonly maxRetries = 3;

  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SmsService();
  }

  async connect(): Promise<void> {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Assert queue exists
      await this.channel!.assertQueue(this.queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dlx',
          'x-dead-letter-routing-key': 'notifications.failed',
        },
      });

      // Assert dead letter queue
      await this.channel!.assertExchange('dlx', 'direct', { durable: true });
      await this.channel!.assertQueue('notifications.failed', { durable: true });
      await this.channel!.bindQueue('notifications.failed', 'dlx', 'notifications.failed');

      logger.info('Connected to RabbitMQ');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', { error });
      throw error;
    }
  }

  async startConsumer(): Promise<void> {
    if (!this.channel) {
      throw new Error('Queue channel not initialized');
    }

    // Set prefetch to process one message at a time
    await this.channel.prefetch(1);

    await this.channel.consume(
      this.queueName,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const job: NotificationJob = JSON.parse(msg.content.toString());
          await this.processJob(job);

          // Acknowledge message
          this.channel!.ack(msg);
        } catch (error) {
          logger.error('Failed to process notification job', { error });

          // Check retry count
          const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;

          if (retryCount < this.maxRetries) {
            // Requeue with incremented retry count
            this.channel!.nack(msg, false, false);
            await this.requeueWithDelay(msg, retryCount);
          } else {
            // Max retries reached, send to dead letter queue
            this.channel!.nack(msg, false, false);
            logger.error('Max retries reached for notification job', {
              jobId: JSON.parse(msg.content.toString()).id,
            });
          }
        }
      },
      { noAck: false }
    );

    logger.info('Notification queue consumer started');
  }

  private async processJob(job: NotificationJob): Promise<void> {
    logger.info('Processing notification job', { jobId: job.id, type: job.type });

    if (job.type === 'email') {
      await this.emailService.sendEmail(job.payload as EmailMessage);
    } else if (job.type === 'sms') {
      await this.smsService.sendSms(job.payload as SmsMessage);
    } else {
      throw new Error(`Unknown notification type: ${job.type}`);
    }
  }

  private async requeueWithDelay(msg: ConsumeMessage, retryCount: number): Promise<void> {
    if (!this.channel) return;

    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff

    await this.channel.sendToQueue(
      this.queueName,
      msg.content,
      {
        headers: {
          'x-retry-count': retryCount,
        },
        expiration: delay.toString(),
      }
    );
  }

  async publishEmail(message: EmailMessage): Promise<void> {
    if (!this.channel) {
      throw new Error('Queue channel not initialized');
    }

    const job: NotificationJob = {
      id: this.generateJobId(),
      type: 'email',
      payload: message,
      attempts: 0,
      maxAttempts: this.maxRetries,
      createdAt: new Date(),
    };

    this.channel.sendToQueue(this.queueName, Buffer.from(JSON.stringify(job)), {
      persistent: true,
    });

    logger.info('Email job queued', { jobId: job.id, recipient: message.to });
  }

  async publishSms(message: SmsMessage): Promise<void> {
    if (!this.channel) {
      throw new Error('Queue channel not initialized');
    }

    const job: NotificationJob = {
      id: this.generateJobId(),
      type: 'sms',
      payload: message,
      attempts: 0,
      maxAttempts: this.maxRetries,
      createdAt: new Date(),
    };

    this.channel.sendToQueue(this.queueName, Buffer.from(JSON.stringify(job)), {
      persistent: true,
    });

    logger.info('SMS job queued', { jobId: job.id, recipient: message.to });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    logger.info('Disconnected from RabbitMQ');
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
