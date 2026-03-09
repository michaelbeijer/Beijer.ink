import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as backupController from '../controllers/backup.controller.js';

const router = Router();

router.get('/download', asyncHandler(backupController.downloadBackup));
router.post('/google-drive/run', asyncHandler(backupController.runGoogleDriveBackup));

export default router;
