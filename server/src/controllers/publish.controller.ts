import { Request, Response } from 'express';
import { config } from '../config.js';
import * as publishService from '../services/publish.service.js';

// Public, but gated by a shared token (query ?token= or x-export-token header).
export async function autofingersFeed(req: Request, res: Response) {
  const provided = (req.query.token as string) || (req.headers['x-export-token'] as string) || '';
  if (!config.autofingersExportToken || provided !== config.autofingersExportToken) {
    res.status(401).json({ error: 'Invalid or missing export token' });
    return;
  }
  const feed = await publishService.getAutofingersFeed();
  res.json(feed);
}

// Authed — the "Publish now" button.
export async function trigger(_req: Request, res: Response) {
  const result = await publishService.triggerPublish();
  if (!result.configured) {
    res.status(503).json({ error: 'No Cloudflare deploy hook configured on the server' });
    return;
  }
  res.json({ triggered: result.ok, status: result.status });
}
