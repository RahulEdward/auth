import { EmailService } from '../services/email.service';
import { EmailMessage } from '../types/notification.types';

// Mock nodemailer
const mockSendMail = jest.fn();
const mockVerify = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify,
  })),
}));

// Mock logger
jest.mock('@auth/shared', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('EmailService', () => {
  let emailService: EmailService;

  beforeAll(() => {
    emailService = new EmailService();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id-123',
        accepted: ['test@example.com'],
      });

      const message: EmailMessage = {
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'email-verification',
        variables: {
          name: 'Test User',
          verificationUrl: 'https://example.com/verify/token123',
          year: new Date().getFullYear(),
        },
      };

      const result = await emailService.sendEmail(message);

      expect(result.status).toBe('sent');
      expect(result.type).toBe('email');
      expect(result.recipient).toBe('test@example.com');
      expect(result.providerId).toBe('test-message-id-123');
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should handle email sending failure', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const message: EmailMessage = {
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'email-verification',
        variables: {
          name: 'Test User',
          verificationUrl: 'https://example.com/verify/token123',
          year: new Date().getFullYear(),
        },
      };

      await expect(emailService.sendEmail(message)).rejects.toThrow('SMTP connection failed');
    });
  });

  describe('verifyConnection', () => {
    it('should verify email connection successfully', async () => {
      mockVerify.mockResolvedValue(true);

      const result = await emailService.verifyConnection();
      
      expect(result).toBe(true);
      expect(mockVerify).toHaveBeenCalled();
    });

    it('should return false on connection failure', async () => {
      mockVerify.mockRejectedValue(new Error('Connection failed'));

      const result = await emailService.verifyConnection();
      
      expect(result).toBe(false);
    });
  });
});
