import { useState, useCallback } from 'react';
import { CloudUpload, Download, Loader2 } from 'lucide-react';
import { downloadBackup, runGoogleDriveBackup } from '../../api/backup';

export function DownloadBackupSection() {
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDownload = useCallback(async () => {
    setError('');
    setSuccess('');
    setDownloadLoading(true);
    try {
      await downloadBackup();
      setSuccess('Backup downloaded');
    } catch {
      setError('Failed to download backup');
    } finally {
      setDownloadLoading(false);
    }
  }, []);

  const handleRunGoogleDriveBackup = useCallback(async () => {
    setError('');
    setSuccess('');
    setRunLoading(true);
    try {
      const result = await runGoogleDriveBackup();
      setSuccess(`Backup uploaded to Google Drive${result.name ? `: ${result.name}` : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload backup to Google Drive');
    } finally {
      setRunLoading(false);
    }
  }, []);

  return (
    <div className="space-y-2">
      <button
        onClick={handleDownload}
        disabled={downloadLoading || runLoading}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left disabled:opacity-50"
      >
        {downloadLoading ? (
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        ) : (
          <Download className="w-5 h-5 text-slate-400" />
        )}
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-900 dark:text-white">
            {downloadLoading ? 'Preparing backup...' : 'Download Backup'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Export all notes as markdown files in a zip</div>
        </div>
      </button>

      <button
        onClick={handleRunGoogleDriveBackup}
        disabled={downloadLoading || runLoading}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left disabled:opacity-50"
      >
        {runLoading ? (
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        ) : (
          <CloudUpload className="w-5 h-5 text-slate-400" />
        )}
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-900 dark:text-white">
            {runLoading ? 'Uploading to Google Drive...' : 'Run Google Drive Backup Now'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Upload backup to Google Drive</div>
        </div>
      </button>

      {error && <p className="text-sm text-red-500 dark:text-red-400 px-4 mt-1">{error}</p>}
      {success && <p className="text-sm text-green-600 dark:text-green-400 px-4 mt-1">{success}</p>}
    </div>
  );
}
