import path from 'path';
import { Readable } from 'stream';
import SftpClient from 'ssh2-sftp-client';
import { config } from '../config.js';
import { createBackupArchive, getBackupFilename } from './backup.service.js';

function hasSftpConfig(): boolean {
  return Boolean(
    config.backupSftpHost &&
    config.backupSftpUsername &&
    config.backupSftpPassword &&
    config.backupSftpRemoteDir,
  );
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export function canUploadBackupsToSftp(): boolean {
  return config.backupEnabled && hasSftpConfig();
}

export async function uploadBackupToSftp(runDate = new Date()) {
  if (!hasSftpConfig()) {
    throw new Error('SFTP backup is not fully configured.');
  }

  const archive = await createBackupArchive();
  const buffer = await streamToBuffer(archive);
  const fileName = getBackupFilename(runDate);
  const remotePath = path.posix.join(config.backupSftpRemoteDir, fileName);

  const sftp = new SftpClient();

  try {
    await sftp.connect({
      host: config.backupSftpHost,
      port: config.backupSftpPort,
      username: config.backupSftpUsername,
      password: config.backupSftpPassword,
      readyTimeout: 20000,
    });

    await sftp.mkdir(config.backupSftpRemoteDir, true);
    await sftp.put(buffer, remotePath);

    return {
      name: fileName,
      path: remotePath,
    };
  } finally {
    await sftp.end().catch(() => undefined);
  }
}
