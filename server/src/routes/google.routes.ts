import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as googleController from '../controllers/google.controller.js';

const router = Router();

// Public — Google redirects the browser here; authenticated via signed `state`.
router.get('/callback', asyncHandler(googleController.callback));

// Everything else needs the app's normal auth.
router.get('/status', requireAuth, asyncHandler(googleController.status));
router.get('/connect', requireAuth, asyncHandler(googleController.connect));
router.get('/calendars', requireAuth, asyncHandler(googleController.listCalendars));
router.put('/calendars', requireAuth, asyncHandler(googleController.saveCalendars));
router.get('/events', requireAuth, asyncHandler(googleController.events));
router.post('/disconnect', requireAuth, asyncHandler(googleController.disconnect));

export default router;
