import { Readable } from 'stream';
import { google } from 'googleapis';
import { config } from '../config.js';
import { createBackupArchive, getBackupFilename } from './backup.service.js';

function hasGoogleDriveConfig(): boolean {
  return Boolean(
    config.googleDriveClientId &&
    config.googleDriveClientSecret &&
    config.googleDriveRefreshToken,
  );
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export function canUploadBackupsToGoogleDrive(): boolean {
  return config.backupEnabled && hasGoogleDriveConfig();
}

export async function uploadBackupToGoogleDrive(runDate = new Date()) {
  if (!hasGoogleDriveConfig()) {
    throw new Error('Google Drive backup is not fully configured.');
  }

  const archive = await createBackupArchive();
  const buffer = await streamToBuffer(archive);
  const fileName = getBackupFilename(runDate);

  const oauth2Client = new google.auth.OAuth2(
    config.googleDriveClientId,
    config.googleDriveClientSecret,
  );
  oauth2Client.setCredentials({ refresh_token: config.googleDriveRefreshToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const fileMetadata: { name: string; parents?: string[] } = { name: fileName };
  if (config.googleDriveFolderId) {
    fileMetadata.parents = [config.googleDriveFolderId];
  }

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType: 'application/zip',
      body: Readable.from(buffer),
    },
    fields: 'id, name, webViewLink',
  });

  return {
    id: response.data.id ?? '',
    name: response.data.name ?? fileName,
    webViewLink: response.data.webViewLink ?? '',
  };
}
