import { Router } from 'express';
import multer from 'multer';
import { userController } from '../controllers/user.controller';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});

// Profile endpoints (all require authentication)
router.get('/me', userController.getProfile.bind(userController));
router.patch('/me', userController.updateProfile.bind(userController));

// Avatar upload
router.post('/me/avatar', upload.single('avatar'), userController.uploadAvatar.bind(userController));

// Account lifecycle
router.post('/me/deactivate', userController.deactivateAccount.bind(userController));
router.delete('/me', userController.deleteAccount.bind(userController));

// GDPR data export
router.get('/me/data-export', userController.exportData.bind(userController));

export default router;
