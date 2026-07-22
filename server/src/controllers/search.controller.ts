import { Request, Response } from 'express';
import { searchQuerySchema } from '../validators/search.schema.js';
import * as searchService from '../services/search.service.js';

export async function search(req: Request, res: Response) {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid search query', details: parsed.error.flatten() });
    return;
  }

  const { q, notebookId, limit, offset } = parsed.data;
  const result = await searchService.searchAll(q, { notebookId, limit, offset });
  res.json(result);
}
