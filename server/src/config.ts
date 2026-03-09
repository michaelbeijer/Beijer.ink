import 'dotenv/config';

function envFlag(value: string | undefined, defaultValue = false): boolean {
  if (value == null) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  databaseUrl: process.env.DATABASE_URL || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  adminEmail: process.env.ADMIN_EMAIL || '',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  backupEnabled: envFlag(process.env.BACKUP_ENABLED),
  backupCron: process.env.BACKUP_CRON || '0 2 * * *',
  backupTimezone: process.env.BACKUP_TIMEZONE || 'Europe/London',
  googleDriveClientId: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
  googleDriveClientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
  googleDriveRefreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '',
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',

  isDev() {
    return this.nodeEnv === 'development';
  },
};
