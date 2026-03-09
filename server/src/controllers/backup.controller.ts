import { Request, Response } from 'express';
import * as backupService from '../services/backup.service.js';
import { canUploadBackupsToSftp } from '../services/sftpBackup.service.js';
import { runSftpBackupNow } from '../services/backupScheduler.service.js';

export async function downloadBackup(_req: Request, res: Response) {
  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${backupService.getBackupFilename()}"`,
  });

  const archive = await backupService.createBackupArchive();
  archive.pipe(res);
}

export async function runSftpBackup(_req: Request, res: Response) {
  if (!canUploadBackupsToSftp()) {
    res.status(400).json({
      error: 'SFTP backup is not fully configured yet.',
    });
    return;
  }

  const result = await runSftpBackupNow();
  res.status(201).json({
    name: result.name,
    path: result.path,
  });
}
