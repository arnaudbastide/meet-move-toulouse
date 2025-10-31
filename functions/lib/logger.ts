import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

const DEV_HINT_VARS = ['VITE_FUNCTIONS_URL'];

export function envHint(): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const missing = DEV_HINT_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.warn(
      `Dev hint: missing environment variable(s) ${missing.join(', ')}. The frontend may need VITE_FUNCTIONS_URL to call the functions server.`,
    );
  }
}

export interface RequestContext {
  requestId: string;
}

export function withRequestId(req: Request, res: Response): RequestContext {
  const incoming = req.header('x-request-id');
  const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  return { requestId };
}

export function logInfo(message: string, context: RequestContext, extra?: Record<string, unknown>): void {
  console.info(JSON.stringify({ level: 'info', message, requestId: context.requestId, ...extra }));
}

export function logError(message: string, context: RequestContext, extra?: Record<string, unknown>): void {
  console.error(JSON.stringify({ level: 'error', message, requestId: context.requestId, ...extra }));
}
