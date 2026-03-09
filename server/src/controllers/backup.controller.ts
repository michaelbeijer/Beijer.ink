import { Request, Response } from 'express';
import * as backupService from '../services/backup.service.js';
import { canUploadBackupsToGoogleDrive } from '../services/googleDriveBackup.service.js';
import { runGoogleDriveBackupNow } from '../services/backupScheduler.service.js';

export async function downloadBackup(_req: Request, res: Response) {
  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${backupService.getBackupFilename()}"`,
  });

  const archive = await backupService.createBackupArchive();
  archive.pipe(res);
}

export async function runGoogleDriveBackup(_req: Request, res: Response) {
  if (!canUploadBackupsToGoogleDrive()) {
    res.status(400).json({
      error: 'Google Drive backup is not fully configured yet.',
    });
    return;
  }

  const result = await runGoogleDriveBackupNow();
  res.status(201).json({
    id: result.id,
    name: result.name,
    webViewLink: result.webViewLink,
  });
}
