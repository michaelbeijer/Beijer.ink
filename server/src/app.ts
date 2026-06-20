import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import notebooksRoutes from './routes/notebooks.routes.js';
import notesRoutes from './routes/notes.routes.js';
import boardsRoutes from './routes/boards.routes.js';
import searchRoutes from './routes/search.routes.js';
import scratchpadRoutes from './routes/scratchpad.routes.js';
import backupRoutes from './routes/backup.routes.js';
import googleRoutes from './routes/google.routes.js';
import publishRoutes from './routes/publish.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // Railway sits behind a reverse proxy — trust X-Forwarded-For for rate limiting
  app.set('trust proxy', 1);

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Health check (unauthenticated, for Railway)
  app.get('/api/health', (_req, res) => { res.json({ status: 'ok' }); });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/notebooks', requireAuth, notebooksRoutes);
  app.use('/api/notes', requireAuth, notesRoutes);
  app.use('/api/boards', requireAuth, boardsRoutes);
  app.use('/api/search', requireAuth, searchRoutes);
  app.use('/api/scratchpad', requireAuth, scratchpadRoutes);
  app.use('/api/backup', requireAuth, backupRoutes);
  // Google routes gate auth per-route (the OAuth callback must stay public).
  app.use('/api/google', googleRoutes);
  // Publish routes gate auth per-route (the export feed is public + token-gated).
  app.use('/api/publish', publishRoutes);

  // Serve static frontend in production only
  const publicPath = path.join(__dirname, '..', 'public');
  if (!config.isDev() && fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));

    // SPA fallback
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }

  // Error handler
  app.use(errorHandler);

  return app;
}
