import nodemailer, { Transporter } from 'nodemailer';
import { emailConfig } from '../config/email.config';
import { EmailMessage, DeliveryStatus } from '../types/notification.types';
import { logger } from '@auth/shared';
import { TemplateService } from './template.service';

export class EmailService {
  private transporter!: Transporter;
  private templateService: TemplateService;

  constructor() {
    this.templateService = new TemplateService();
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    if (emailConfig.provider === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtp!.host,
        port: emailConfig.smtp!.port,
        secure: emailConfig.smtp!.secure,
        auth: {
          user: emailConfig.smtp!.auth.user,
          pass: emailConfig.smtp!.auth.pass,
        },
      });
    } else {
      // For other providers, we would initialize their specific clients
      // For now, fallback to SMTP
      logger.warn(`Email provider ${emailConfig.provider} not fully implemented, using SMTP`);
      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtp!.host,
        port: emailConfig.smtp!.port,
        secure: emailConfig.smtp!.secure,
        auth: {
          user: emailConfig.smtp!.auth.user,
          pass: emailConfig.smtp!.auth.pass,
        },
      });
    }
  }

  async sendEmail(message: EmailMessage): Promise<DeliveryStatus> {
    const deliveryStatus: DeliveryStatus = {
      id: this.generateId(),
      type: 'email',
      recipient: Array.isArray(message.to) ? message.to.join(', ') : message.to,
      status: 'pending',
      provider: emailConfig.provider,
      createdAt: new Date(),
    };

    try {
      // Render email template
      const html = await this.templateService.render(message.template, message.variables);
      const text = await this.templateService.renderText(message.template, message.variables);

      // Send email
      const info = await this.transporter.sendMail({
        from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
        to: message.to,
        subject: message.subject,
        text,
        html,
        replyTo: emailConfig.replyTo,
        attachments: message.attachments,
        priority: message.priority || 'normal',
      });

      deliveryStatus.status = 'sent';
      deliveryStatus.providerId = info.messageId;
      deliveryStatus.sentAt = new Date();

      logger.info('Email sent successfully', {
        messageId: info.messageId,
        recipient: deliveryStatus.recipient,
        template: message.template,
      });

      return deliveryStatus;
    } catch (error) {
      deliveryStatus.status = 'failed';
      deliveryStatus.error = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to send email', {
        error: deliveryStatus.error,
        recipient: deliveryStatus.recipient,
        template: message.template,
      });

      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed', { error });
      return false;
    }
  }

  private generateId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
