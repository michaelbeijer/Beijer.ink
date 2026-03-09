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
  const handleKeyboardInteractive = (
    _name: string,
    _instructions: string,
    _lang: string,
    prompts: Array<{ prompt: string; echo: boolean }>,
    finish: (responses: string[]) => void,
  ) => {
    if (prompts.length === 0) {
      finish([]);
      return;
    }

    // Some shared hosts expose password auth via keyboard-interactive prompts.
    finish(prompts.map(() => config.backupSftpPassword));
  };

  try {
    sftp.on('keyboard-interactive', handleKeyboardInteractive);

    const connectionOptions = {
      host: config.backupSftpHost,
      port: config.backupSftpPort,
      username: config.backupSftpUsername,
      password: config.backupSftpPassword,
      tryKeyboard: true,
      readyTimeout: 20000,
    };

    await sftp.connect(connectionOptions);

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





