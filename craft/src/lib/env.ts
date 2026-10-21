function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

const optional = (name: string, fallback = '') => process.env[name] || fallback;

export const isProduction = process.env.NODE_ENV === 'production';

export const env = {
  get authSecret() {
    const v = required('AUTH_SECRET');
    if (v.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters');
    return v;
  },
  get encryptionKey() {
    const v = required('APP_ENCRYPTION_KEY');
    if (v.length < 32) throw new Error('APP_ENCRYPTION_KEY must be at least 32 characters');
    return v;
  },
  get appUrl() {
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    return (process.env.APP_URL || (vercel ? `https://${vercel}` : 'http://localhost:3000')).replace(/\/$/, '');
  },
  get cronSecret() {
    return optional('CRON_SECRET');
  },
  sms: {
    get driver() {
      return optional('SMS_DRIVER', 'console') as 'console' | 'unifonic' | 'twilio';
    },
    get unifonicAppSid() {
      return optional('UNIFONIC_APP_SID');
    },
    get unifonicSender() {
      return optional('UNIFONIC_SENDER_ID');
    },
    get twilioSid() {
      return optional('TWILIO_ACCOUNT_SID');
    },
    get twilioToken() {
      return optional('TWILIO_AUTH_TOKEN');
    },
    get twilioFrom() {
      return optional('TWILIO_FROM');
    },
  },
  storage: {
    get driver() {
      return optional('STORAGE_DRIVER', 'database') as 'database' | 's3' | 'local';
    },
    get localDir() {
      return optional('STORAGE_LOCAL_DIR', './storage');
    },
    get s3Bucket() {
      return optional('S3_BUCKET');
    },
    get s3Region() {
      return optional('S3_REGION', 'auto');
    },
    get s3Endpoint() {
      return process.env.S3_ENDPOINT || undefined;
    },
    get s3AccessKeyId() {
      return optional('S3_ACCESS_KEY_ID');
    },
    get s3SecretAccessKey() {
      return optional('S3_SECRET_ACCESS_KEY');
    },
    get publicBaseUrl() {
      return optional('MEDIA_PUBLIC_BASE_URL').replace(/\/$/, '');
    },
  },
  ai: {
    get apiKey() {
      return optional('ANTHROPIC_API_KEY');
    },
    get model() {
      return optional('INVOICE_AI_MODEL', 'claude-opus-5-5');
    },
  },
  push: {
    get publicKey() {
      return optional('NEXT_PUBLIC_VAPID_PUBLIC_KEY');
    },
    get privateKey() {
      return optional('VAPID_PRIVATE_KEY');
    },
    get subject() {
      return optional('VAPID_SUBJECT', 'mailto:support@hirfa.sa');
    },
  },
  googleWallet: {
    get issuerId() {
      return optional('GOOGLE_WALLET_ISSUER_ID');
    },
    get serviceAccountEmail() {
      return optional('GOOGLE_WALLET_SA_EMAIL');
    },
    get privateKey() {
      return optional('GOOGLE_WALLET_SA_PRIVATE_KEY').replace(/\\n/g, '\n');
    },
  },
};
