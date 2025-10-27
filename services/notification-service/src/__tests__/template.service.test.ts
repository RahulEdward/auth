import { TemplateService } from '../services/template.service';

// Mock logger
jest.mock('@auth/shared', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeAll(() => {
    templateService = new TemplateService();
  });

  describe('render', () => {
    it('should render email verification template', async () => {
      const variables = {
        name: 'John Doe',
        verificationUrl: 'https://example.com/verify/abc123',
        year: 2024,
      };

      const html = await templateService.render('email-verification', variables);

      expect(html).toContain('John Doe');
      expect(html).toContain('https://example.com/verify/abc123');
      expect(html).toContain('2024');
      expect(html).toContain('Verify Your Email');
    });

    it('should render password reset template', async () => {
      const variables = {
        name: 'Jane Smith',
        resetUrl: 'https://example.com/reset/xyz789',
        year: 2024,
      };

      const html = await templateService.render('password-reset', variables);

      expect(html).toContain('Jane Smith');
      expect(html).toContain('https://example.com/reset/xyz789');
      expect(html).toContain('Reset Your Password');
    });

    it('should render MFA code template', async () => {
      const variables = {
        name: 'Test User',
        code: '123456',
        year: 2024,
      };

      const html = await templateService.render('mfa-code', variables);

      expect(html).toContain('Test User');
      expect(html).toContain('123456');
      expect(html).toContain('Verification Code');
    });

    it('should handle template not found', async () => {
      await expect(
        templateService.render('non-existent-template', {})
      ).rejects.toThrow();
    });
  });

  describe('renderText', () => {
    it('should render text version of template', async () => {
      const variables = {
        name: 'John Doe',
        verificationUrl: 'https://example.com/verify/abc123',
        year: 2024,
      };

      const text = await templateService.renderText('email-verification', variables);

      expect(text).toContain('John Doe');
      expect(text).toContain('https://example.com/verify/abc123');
    });

    it('should return empty string for missing text template', async () => {
      const text = await templateService.renderText('non-existent', {});
      expect(text).toBe('');
    });
  });

  describe('Handlebars helpers', () => {
    it('should format dates correctly', async () => {
      const variables = {
        name: 'Test',
        changedAt: new Date('2024-01-15'),
        ipAddress: '192.168.1.1',
        device: 'Chrome on Windows',
        year: 2024,
      };

      const html = await templateService.render('password-changed', variables);

      expect(html).toContain('January 15, 2024');
    });

    it('should format currency correctly', async () => {
      const variables = {
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date(),
        dueDate: new Date(),
        items: [{ description: 'Subscription', amount: 29.99 }],
        subtotal: 29.99,
        total: 29.99,
        currency: 'USD',
        year: 2024,
      };

      const html = await templateService.render('invoice', variables);

      expect(html).toContain('$29.99');
    });
  });

  describe('clearCache', () => {
    it('should clear template cache', () => {
      expect(() => templateService.clearCache()).not.toThrow();
    });
  });
});
