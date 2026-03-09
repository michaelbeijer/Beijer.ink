import api from './client';

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'error' in error.response.data &&
    typeof error.response.data.error === 'string'
  ) {
    return error.response.data.error;
  }

  return fallback;
}

export async function downloadBackup(): Promise<void> {
  const { data } = await api.get('/backup/download', { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `beijer-ink-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface GoogleDriveBackupResult {
  id?: string | null;
  name?: string | null;
  webViewLink?: string | null;
}

export async function runGoogleDriveBackup(): Promise<GoogleDriveBackupResult> {
  try {
    const { data } = await api.post<GoogleDriveBackupResult>('/backup/google-drive/run');
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to upload backup to Google Drive'));
  }
}
