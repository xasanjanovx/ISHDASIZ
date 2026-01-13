import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Adjust this value in production
    tracesSampleRate: 0.1,

    debug: false,
});
