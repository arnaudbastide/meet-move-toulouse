import express from 'express';
import Stripe from 'stripe';
import { fileURLToPath } from 'node:url';
import type { Request, Response, NextFunction } from 'express';
import { assertRequiredEnv } from './lib/env.js';
import { createSupabaseServiceClient, type SupabaseServiceClient } from './lib/supabase.js';
import { withRequestId, logError } from './lib/logger.js';
import { sendError } from './lib/responses.js';
import { RequestError } from './lib/errors.js';
import { createAccountLinkSchema, createPaymentIntentSchema, attachBookingTransferSchema } from './lib/validation.js';
import { createAccountLink } from './stripe/onboarding.js';
import { attachBookingTransfer, createPaymentIntent } from './stripe/payments.js';
import { createWebhookHandler } from './stripe/webhook.js';

declare module 'express-serve-static-core' {
  interface Response {
    locals: Record<string, unknown> & { requestContext: ReturnType<typeof withRequestId> };
  }
}

export function createApp(dependencies?: {
  stripe?: Stripe;
  webhookSecret?: string;
  supabase?: SupabaseServiceClient;
}) {
  const env = assertRequiredEnv();
  const stripe =
    dependencies?.stripe ?? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-11-20' });
  const webhookSecret = dependencies?.webhookSecret ?? env.STRIPE_WEBHOOK_SECRET;
  const supabase = dependencies?.supabase ?? createSupabaseServiceClient(env);

  const app = express();

  app.use((req: Request, res: Response, next: NextFunction) => {
    const context = withRequestId(req, res);
    res.locals.requestContext = context;
    next();
  });

  app.use((req, res, next) => {
    if (req.originalUrl === '/webhook') {
      return next();
    }
    return express.json({ limit: '1mb' })(req, res, next);
  });

  const deps = { stripe, supabase } as const;

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/create-account-link', async (req, res) => {
    const parsed = createAccountLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload', code: 'invalid_request' });
    }

    try {
      const result = await createAccountLink(parsed.data, deps, res.locals.requestContext);
      return res.json(result);
    } catch (error) {
      return handleHandlerError(error, res);
    }
  });

  app.post('/create-payment-intent', async (req, res) => {
    const parsed = createPaymentIntentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload', code: 'invalid_request' });
    }

    const idempotencyKey = req.header('idempotency-key') ?? res.locals.requestContext.requestId;

    try {
      const result = await createPaymentIntent(
        { ...parsed.data, idempotencyKey },
        deps,
        res.locals.requestContext,
      );
      return res.json(result);
    } catch (error) {
      return handleHandlerError(error, res);
    }
  });

  app.post('/attach-booking-transfer', async (req, res) => {
    const parsed = attachBookingTransferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload', code: 'invalid_request' });
    }

    try {
      const result = await attachBookingTransfer(parsed.data, deps, res.locals.requestContext);
      return res.json(result);
    } catch (error) {
      return handleHandlerError(error, res);
    }
  });

  app.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    createWebhookHandler({ stripe, supabase, webhookSecret }),
  );

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logError('Unhandled error', res.locals.requestContext, {
      error: err instanceof Error ? err.message : 'unknown_error',
    });
    if (err instanceof RequestError) {
      return sendError(res, err);
    }
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

function handleHandlerError(error: unknown, res: Response): Response {
  if (error instanceof RequestError) {
    logError('Request error', res.locals.requestContext, {
      error: error.message,
      code: error.code,
    });
    return sendError(res, error);
  }

  logError('Unexpected error', res.locals.requestContext, {
    error: error instanceof Error ? error.message : 'unknown_error',
  });
  return res.status(500).json({ error: 'Internal server error' });
}

const isDirectRun = (() => {
  const current = fileURLToPath(import.meta.url);
  const executed = process.argv[1];
  return executed ? current === executed : false;
})();

const appInstance = createApp();

if (isDirectRun) {
  const port = Number.parseInt(process.env.PORT ?? '8787', 10);
  appInstance.listen(port, () => {
    console.log(`Stripe functions listening on port ${port}`);
  });
}

export default appInstance;
