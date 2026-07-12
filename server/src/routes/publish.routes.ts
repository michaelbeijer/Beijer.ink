import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as publishController from '../controllers/publish.controller.js';

const router = Router();

// Public read-only export feed for the autofingers.com build — token-gated,
// scoped to publishTarget notebooks only (never exposes other notes).
router.get('/autofingers', asyncHandler(publishController.autofingersFeed));

// "Publish now" — authed; pokes the Cloudflare deploy hook to rebuild the site.
router.post('/trigger', requireAuth, asyncHandler(publishController.trigger));

// Beijerterm.com terminology-article feed — token-gated, scoped to
// publishBeijerterm notebooks only. Parallel to the autofingers routes above.
router.get('/beijerterm', asyncHandler(publishController.beijertermFeed));
router.post('/trigger-beijerterm', requireAuth, asyncHandler(publishController.triggerBeijerterm));

export default router;
