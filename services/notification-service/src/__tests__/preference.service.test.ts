import { PreferenceService } from '../services/preference.service';

jest.mock('@auth/shared', () => ({
  db: {
    query: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { db } from '@auth/shared';
const mockQuery = db.query as jest.Mock;

describe('PreferenceService', () => {
  let preferenceService: PreferenceService;
  const mockUserId = 'user-123';

  beforeAll(() => {
    preferenceService = new PreferenceService();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPreferences', () => {
    it('should return user notification preferences', async () => {
      const mockPreferences = {
        notifications: {
          email: true,
          sms: true,
          push: false,
          marketing: true,
          updates: true,
        },
      };

      mockQuery.mockResolvedValue({
        rows: [{ preferences: mockPreferences }],
      });

      const result = await preferenceService.getPreferences(mockUserId);

      expect(result).toEqual({
        userId: mockUserId,
        email: true,
        sms: true,
        push: false,
        marketing: true,
        security: true,
        updates: true,
      });
    });

    it('should return default preferences when user has no preferences set', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ preferences: {} }],
      });

      const result = await preferenceService.getPreferences(mockUserId);

      expect(result.email).toBe(true);
      expect(result.sms).toBe(true);
      expect(result.security).toBe(true);
    });

    it('should throw error when user not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
      });

      await expect(preferenceService.getPreferences(mockUserId)).rejects.toThrow('User not found');
    });
  });

  describe('shouldSendEmail', () => {
    it('should return true for security emails regardless of preferences', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ preferences: { notifications: { email: true, security: true } } }],
      });

      const result = await preferenceService.shouldSendEmail(mockUserId, 'security');

      expect(result).toBe(true);
    });

    it('should respect marketing email preferences', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ preferences: { notifications: { email: true, marketing: false } } }],
      });

      const result = await preferenceService.shouldSendEmail(mockUserId, 'marketing');

      expect(result).toBe(false);
    });

    it('should return true by default on error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const result = await preferenceService.shouldSendEmail(mockUserId, 'updates');

      expect(result).toBe(true);
    });
  });

  describe('shouldSendSms', () => {
    it('should return true for security SMS when SMS enabled', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ preferences: { notifications: { sms: true, security: true } } }],
      });

      const result = await preferenceService.shouldSendSms(mockUserId, 'security');

      expect(result).toBe(true);
    });

    it('should return false by default on error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const result = await preferenceService.shouldSendSms(mockUserId, 'marketing');

      expect(result).toBe(false);
    });
  });

  describe('unsubscribeFromMarketing', () => {
    it('should unsubscribe user from marketing emails', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await preferenceService.unsubscribeFromMarketing(mockUserId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [mockUserId]
      );
    });

    it('should throw error on database failure', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(preferenceService.unsubscribeFromMarketing(mockUserId)).rejects.toThrow();
    });
  });

  describe('unsubscribeFromAll', () => {
    it('should unsubscribe user from all notifications', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await preferenceService.unsubscribeFromAll(mockUserId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [mockUserId]
      );
    });
  });
});
