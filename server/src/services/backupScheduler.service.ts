import cron from 'node-cron';
import { config } from '../config.js';
import {
  canUploadBackupsToSftp,
  uploadBackupToSftp,
} from './sftpBackup.service.js';

let backupInProgress = false;

export async function runSftpBackupNow() {
  if (backupInProgress) {
    throw new Error('A backup is already running.');
  }

  backupInProgress = true;

  try {
    return await uploadBackupToSftp();
  } catch (error) {
    console.error('[backup] SFTP backup failed:', error);
    throw error;
  } finally {
    backupInProgress = false;
  }
}

export function startBackupScheduler() {
  if (!config.backupEnabled) {
    console.log('[backup] Daily SFTP backup is disabled.');
    return;
  }

  if (!canUploadBackupsToSftp()) {
    console.warn('[backup] Daily backup is enabled, but SFTP credentials or remote directory are missing.');
    return;
  }

  if (!cron.validate(config.backupCron)) {
    console.error(`[backup] Invalid BACKUP_CRON expression: ${config.backupCron}`);
    return;
  }

  cron.schedule(config.backupCron, () => {
    void runSftpBackupNow()
      .then((result) => {
        console.log(`[backup] Uploaded ${result.name} to SFTP path ${result.path}.`);
      })
      .catch(() => {
        // Error already logged in runSftpBackupNow.
      });
  }, {
    timezone: config.backupTimezone,
  });

  console.log(`[backup] Daily SFTP backup scheduled with '${config.backupCron}' in ${config.backupTimezone}.`);
}
