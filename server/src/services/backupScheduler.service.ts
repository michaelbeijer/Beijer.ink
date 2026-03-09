import cron from 'node-cron';
import { config } from '../config.js';
import {
  canUploadBackupsToGoogleDrive,
  uploadBackupToGoogleDrive,
} from './googleDriveBackup.service.js';

let backupInProgress = false;

export async function runGoogleDriveBackupNow() {
  if (backupInProgress) {
    throw new Error('A backup is already running.');
  }

  backupInProgress = true;

  try {
    return await uploadBackupToGoogleDrive();
  } catch (error) {
    console.error('[backup] Google Drive backup failed:', error);
    throw error;
  } finally {
    backupInProgress = false;
  }
}

export function startBackupScheduler() {
  if (!config.backupEnabled) {
    console.log('[backup] Daily Google Drive backup is disabled.');
    return;
  }

  if (!canUploadBackupsToGoogleDrive()) {
    console.warn('[backup] Daily backup is enabled, but Google Drive credentials are missing.');
    return;
  }

  if (!cron.validate(config.backupCron)) {
    console.error(`[backup] Invalid BACKUP_CRON expression: ${config.backupCron}`);
    return;
  }

  cron.schedule(config.backupCron, () => {
    void runGoogleDriveBackupNow()
      .then((result) => {
        console.log(`[backup] Uploaded ${result.name} to Google Drive (${result.id}).`);
      })
      .catch(() => {
        // Error already logged in runGoogleDriveBackupNow.
      });
  }, {
    timezone: config.backupTimezone,
  });

  console.log(`[backup] Daily Google Drive backup scheduled with '${config.backupCron}' in ${config.backupTimezone}.`);
}
