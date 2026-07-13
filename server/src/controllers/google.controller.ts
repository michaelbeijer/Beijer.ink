import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { config } from '../config.js';
import * as googleService from '../services/google.service.js';

export async function status(req: AuthRequest, res: Response) {
  res.json(await googleService.getStatus(req.userId!));
}

export async function connect(req: AuthRequest, res: Response) {
  if (!googleService.isConfigured()) {
    res.status(400).json({ error: 'Google Calendar integration is not configured on the server.' });
    return;
  }
  res.json({ url: googleService.getAuthUrl(req.userId!) });
}

// Public — Google redirects the browser here (no auth header); we authenticate
// via the signed `state`, then bounce back into the app.
export async function callback(req: Request, res: Response) {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const back = (status: string) => res.redirect(`${config.appUrl}/?google=${status}`);
  if (error || !code || !state) return back('error');
  try {
    const userId = googleService.verifyState(state);
    await googleService.handleCallback(userId, code);
    back('connected');
  } catch {
    back('error');
  }
}

export async function listCalendars(req: AuthRequest, res: Response) {
  res.json(await googleService.listCalendars(req.userId!));
}

export async function saveCalendars(req: AuthRequest, res: Response) {
  const calendars = Array.isArray(req.body?.calendars) ? req.body.calendars : [];
  await googleService.saveCalendars(req.userId!, calendars);
  res.json({ ok: true });
}

export async function events(req: AuthRequest, res: Response) {
  const { from, to } = req.query as { from?: string; to?: string };
  res.json(await googleService.getEvents(req.userId!, from, to));
}

export async function taskLists(req: AuthRequest, res: Response) {
  res.json(await googleService.listTaskLists(req.userId!));
}

export async function disconnect(req: AuthRequest, res: Response) {
  await googleService.disconnect(req.userId!);
  res.json({ ok: true });
}
