# Beijer.ink

A personal note-taking web app with a WYSIWYG rich text editor, full-text search, and a clean responsive UI. Built as a single-user app, accessible as a PWA on mobile.

<img width="1509" height="1206" alt="image" src="https://github.com/user-attachments/assets/3136f331-db0a-4742-ab1b-78b425995bd8" />

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tiptap (ProseMirror), Tailwind CSS 4, React Query |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Prisma ORM) |
| Search | PostgreSQL full-text search (tsvector + GIN index) |
| Auth | Single password with bcrypt + JWT |
| Deployment | Docker on Railway |

## Features

- **WYSIWYG rich text editor** — Tiptap-based editor where bold text looks bold, headings look like headings, tables are visual grids, and task lists have checkboxes — no Markdown syntax required
- **Block-level editing** — Large documents (50KB+) render as fast static HTML; clicking any block activates just that block in a live editor, preventing browser freezes on very large notes
- **Formatting toolbar** — Toggleable toolbar for bold, italic, underline, strikethrough, headings, code, links, lists, blockquotes, tables, and horizontal rules; buttons highlight to show active formats; available in both the note editor and scratchpad
- **Table of contents** — Auto-generated panel listing all headings with click-to-jump navigation; toggle via the tree icon in the action bar
- **Table editing** — Right-click inside a table for a context menu to add/delete rows and columns, toggle header rows, merge/split cells, or delete the table
- **Fullscreen mode** — Expand the editor to fill the entire page; exit with Escape
- **Global search** — Weighted PostgreSQL FTS across all notes (title boosted over content), with highlighted result snippets
- **Notebooks** — Organize notes in a hierarchical tree with right-click context menu for moving, renaming, and creating sub-notebooks
- **Favourites** — Pin folders or notes to a dedicated section at the top of the sidebar for quick access
- **Drag-and-drop** — Move notes and folders in and out of other folders directly in the sidebar tree
- **Root notes** — Create notes outside of any notebook; they appear in the sidebar below the notebook tree and open directly in the editor
- **Scratchpad** — Instant-access editor on app load for quick jotting; auto-saved and always available
- **Auto-save** — 1-second debounce, saves in the background
- **Responsive layout** — 3-column desktop, 2-column tablet, single-column mobile with bottom navigation
- **5 themes** — Light, Dark, Rose, Lavender, and Mint; preference saved across sessions
- **PWA** — Installable on Android via "Add to Home Screen"

## Project Structure

```
beijer.ink/
├── client/               # React + Vite frontend
│   ├── src/
│   │   ├── api/          # Axios API wrappers
│   │   ├── components/   # UI components (layout, editor, notes, search, auth)
│   │   ├── editor/       # Tiptap extensions (search highlighting)
│   │   ├── hooks/        # React hooks (useAuth, useAutoSave, useTiptap, useSearch)
│   │   └── types/        # TypeScript type definitions
│   └── public/           # PWA manifest, icons, service worker
├── server/               # Express API backend
│   ├── src/
│   │   ├── routes/       # Express route definitions
│   │   ├── controllers/  # Request handlers
│   │   ├── services/     # Business logic + database queries
│   │   ├── middleware/    # Auth, validation, error handling
│   │   ├── validators/   # Zod schemas
│   │   └── lib/          # Prisma client, R2 client, utilities
│   └── prisma/           # Schema + migrations
├── scripts/              # Seed password, Google Drive auth setup
└── Dockerfile            # Multi-stage production build
```

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL database (local or hosted)

### Setup

1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/michaelbeijer/beijer.ink.git
   cd beijer.ink
   npm install
   ```

2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   Fill in your `DATABASE_URL`, `JWT_SECRET` (64-char hex string), and `ADMIN_PASSWORD`.

3. Copy `.env` to the server directory (Prisma requires it there):
   ```bash
   cp .env server/.env
   ```

4. Run database migrations:
   ```bash
   npm run db:migrate
   ```

5. Seed the admin password:
   ```bash
   npm run seed
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```
   The client runs on `http://localhost:5173` and the API on `http://localhost:3000`.

### Production Build

Build and start in production mode:
```bash
npm run build
npm start
```

Or use Docker:
```bash
docker build -f server/Dockerfile -t beijer-ink .
docker run -p 3000:3000 --env-file .env beijer-ink
```

## API Endpoints

All endpoints under `/api`, JWT-protected except login.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Authenticate with password |
| `GET` | `/api/auth/verify` | Verify JWT token |
| `GET` | `/api/notebooks` | List all notebooks |
| `POST` | `/api/notebooks` | Create notebook |
| `PATCH` | `/api/notebooks/:id` | Update notebook |
| `DELETE` | `/api/notebooks/:id` | Delete notebook |
| `GET` | `/api/notes/root` | List root-level notes (no notebook) |
| `GET` | `/api/notes/notebook/:notebookId` | List notes in notebook |
| `GET` | `/api/notes/:id` | Get single note |
| `POST` | `/api/notes` | Create note |
| `PATCH` | `/api/notes/:id` | Update note (auto-save) |
| `DELETE` | `/api/notes/:id` | Delete note |
| `PATCH` | `/api/notes/:id/move` | Move note to another notebook |
| `GET` | `/api/scratchpad` | Get scratchpad content |
| `PUT` | `/api/scratchpad` | Update scratchpad content |
| `GET` | `/api/search?q=...` | Full-text search with highlighted snippets |
| `GET` | `/api/backup/download` | Download all notes as a zip of markdown files |
| `POST` | `/api/backup/google-drive/run` | Upload backup to Google Drive |

## Deployment (Railway)

1. Create a new Railway project with a PostgreSQL add-on
2. Add a web service pointing to this repo
3. Set environment variables: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_PASSWORD`, `NODE_ENV=production`
4. Railway will build using the Dockerfile and run migrations on startup
5. Configure your custom domain in Railway settings

## Daily Google Drive Backups

Automatic daily backups upload a ZIP of all notes (as markdown files preserving notebook folder structure) to your Google Drive. You can also trigger an upload manually from Settings with "Run Google Drive Backup Now".

### Setup

1. Create an OAuth client (Desktop app) in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) with the Drive API enabled
2. Run the one-time auth script to get a refresh token:
   ```bash
   npx tsx scripts/google-drive-auth.ts
   ```
3. Set these environment variables on Railway:
   - `BACKUP_ENABLED=true`
   - `BACKUP_CRON=0 2 * * *` (default: 2 AM daily)
   - `BACKUP_TIMEZONE=Europe/London`
   - `GOOGLE_DRIVE_CLIENT_ID=...`
   - `GOOGLE_DRIVE_CLIENT_SECRET=...`
   - `GOOGLE_DRIVE_REFRESH_TOKEN=...`
   - `GOOGLE_DRIVE_FOLDER_ID=...` (optional — omit to upload to Drive root)

## License

This project is for personal use. All rights reserved.





