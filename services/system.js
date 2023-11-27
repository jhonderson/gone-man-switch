
/**
 * @returns All system settings except the following environment variables:
 * NODE_ENV, PORT, SSL_KEY, SSL_CERT, SSL_KEY_PASSPHRASE, LOG_LEVEL
 * Why? Those settings will most likely always come from environment variables.
 * Everything else should be provided by this service component, so that it may come
 * from a different source later one (i.e database or config file)
 *
 * Warning: This returns sensitive content, be careful when sending this to logs or user interface
 */
const getSystemSettings = () => {
  return {
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
      secure: process.env.SMTP_SECURE == 'true',
      from: process.env.SMTP_FROM,
      username: process.env.SMTP_USERNAME,
      authMechanism: process.env.SMTP_AUTH_MECHANISM,
      password: process.env.SMTP_PASSWORD,
    },
    sqlite: {
      path: process.env.SQLITE_DB_PATH || "/app/data/gonemanswitch.db"
    },
    checkin: {
      serverUrl: (process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, ""),
      checkinNotificationsJobCron: process.env.CHECKIN_NOTIFICATIONS_JOB_CRON || '0 8 * * *',
      messagesJobCron: process.env.MESSAGES_JOB_CRON || '0 8 * * *',
      email: {
        subject: "Gone Man's Switch - Check-in Notification",
        bodyFormat: 'Hello,\n\nCould you please confirm you are still available using the following link?: %s\n\nThanks!',
      }
    },
    message: {
      maxAttachmentSizeInMB: 20,
      encryptionPassword: process.env.MESSAGE_ENCRYPTION_PASSWORD,
      customEncryptionBodyFormat: 'Hello,\n\nYou received an encrypted message from a close one (see the subject for more information), please decrypt it using the following link: %s\n\nSince you will be asked an encryption password, this is the encryption password hint "%s"\n\nThanks!',
    },
    cookieSession: {
      secret: process.env.COOKIE_SESSION_SECRET || 'default-gonemanswitch-session-cookie-secret',
      maxAgeDays: process.env.COOKIE_SESSION_MAX_AGE_DAYS ? Number(process.env.COOKIE_SESSION_MAX_AGE_DAYS) : 2,
    },
    defaultUser: {
      username: 'admin',
      email: process.env.DEFAULT_ADMIN_USER_EMAIL,
      password: process.env.DEFAULT_ADMIN_USER_PASSWORD || 'password',
    }
  };
}

module.exports = {
  getSystemSettings,
}
