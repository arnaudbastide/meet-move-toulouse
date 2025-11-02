import type { Response } from 'express';
import { RequestError } from './errors.js';

export function sendError(res: Response, error: RequestError): Response {
  return res.status(error.status).json({ error: error.message, code: error.code });
}
