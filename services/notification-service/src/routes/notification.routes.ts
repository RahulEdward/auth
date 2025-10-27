import { Router, Request, Response } from 'express';
import { PreferenceService } from '../services/preference.service';
import { logger } from '@auth/shared';

const router = Router();
const preferenceService = new PreferenceService();

// Get notification preferences
router.get('/preferences/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const preferences = await preferenceService.getPreferences(userId);
    res.json(preferences);
  } catch (error) {
    logger.error('Failed to get preferences', { error });
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// Unsubscribe from marketing emails
router.post('/unsubscribe/marketing/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await preferenceService.unsubscribeFromMarketing(userId);
    res.json({ message: 'Successfully unsubscribed from marketing emails' });
  } catch (error) {
    logger.error('Failed to unsubscribe from marketing', { error });
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// Unsubscribe from all notifications
router.post('/unsubscribe/all/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await preferenceService.unsubscribeFromAll(userId);
    res.json({ message: 'Successfully unsubscribed from all notifications' });
  } catch (error) {
    logger.error('Failed to unsubscribe from all', { error });
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

export default router;
