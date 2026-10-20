function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return required('DATABASE_URL');
  },
  get authSecret() {
    const v = required('AUTH_SECRET');
    if (v.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters');
    return v;
  },
  get encryptionKey() {
    return required('APP_ENCRYPTION_KEY');
  },
  get appUrl() {
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    return (process.env.APP_URL || (vercel ? `https://${vercel}` : 'http://localhost:3000')).replace(/\/$/, '');
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? '';
  },
  telegram: {
    get botToken() {
      return process.env.TELEGRAM_BOT_TOKEN ?? '';
    },
    get botUsername() {
      return process.env.TELEGRAM_BOT_USERNAME ?? '';
    },
    get webhookSecret() {
      return process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
    },
  },
  smtp: {
    get host() {
      return process.env.SMTP_HOST ?? '';
    },
    get port() {
      return Number(process.env.SMTP_PORT ?? 587);
    },
    get secure() {
      return process.env.SMTP_SECURE === 'true';
    },
    get user() {
      return process.env.SMTP_USER ?? '';
    },
    get password() {
      return process.env.SMTP_PASSWORD ?? '';
    },
    get from() {
      return process.env.SMTP_FROM ?? '';
    },
  },
  storage: {
    get driver() {
      return (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3' | 'database';
    },
    get localDir() {
      return process.env.STORAGE_LOCAL_DIR ?? './storage';
    },
    get s3Bucket() {
      return process.env.S3_BUCKET ?? '';
    },
    get s3Region() {
      return process.env.S3_REGION ?? 'auto';
    },
    get s3Endpoint() {
      return process.env.S3_ENDPOINT || undefined;
    },
    get s3AccessKeyId() {
      return process.env.S3_ACCESS_KEY_ID ?? '';
    },
    get s3SecretAccessKey() {
      return process.env.S3_SECRET_ACCESS_KEY ?? '';
    },
  },
  moyasar: {
    get secretKey() {
      return process.env.MOYASAR_SECRET_KEY ?? '';
    },
  },
  get vatPercent() {
    return Number(process.env.VAT_PERCENT ?? 15);
  },
  get trialDays() {
    return Number(process.env.TRIAL_DAYS ?? 7);
  },
};
