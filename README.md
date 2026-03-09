# Beijer.ink

A personal note-taking web app with inline markdown styling, full-text search, and a clean responsive UI. Built as a single-user app, accessible as a PWA on mobile.

<img width="1509" height="1206" alt="image" src="https://github.com/user-attachments/assets/3136f331-db0a-4742-ab1b-78b425995bd8" />

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, CodeMirror 6, Tailwind CSS 4, React Query |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Prisma ORM) |
| Search | PostgreSQL full-text search (tsvector + GIN index) |
| Auth | Single password with bcrypt + JWT |
| Deployment | Docker on Railway |

## Features

- **Inline markdown editor** — CodeMirror 6 with live markdown styling: bold text appears bold, headers are larger, code is highlighted, and markup characters remain visible but dimmed
- **Markdown toolbar** — Toggleable formatting toolbar for bold, italic, strikethrough, headings, code, links, lists, blockquotes, and horizontal rules
- **Fullscreen mode** — Expand the editor to fill the entire page; exit with Escape
- **Global search** — Weighted PostgreSQL FTS across all notes (title boosted over content), with highlighted result snippets
- **Notebooks** — Organize notes in a hierarchical tree with right-click context menu for moving, renaming, and creating sub-notebooks
- **Root notes** — Create notes outside of any notebook; they appear in the sidebar below the notebook tree and open directly in the editor
- **Scratchpad** — Instant-access editor on app load for quick jotting; auto-saved and always available
- **Auto-save** — 1-second debounce, saves in the background
- **Responsive layout** — 3-column desktop, 2-column tablet, single-column mobile with bottom navigation
- **Light/Dark mode** — Toggle between light and dark themes, preference saved across sessions
- **PWA** — Installable on Android via "Add to Home Screen"

## Project Structure

```
beijer.ink/
├── client/               # React + Vite frontend
│   ├── src/
│   │   ├── api/          # Axios API wrappers
│   │   ├── components/   # UI components (layout, editor, notes, search, auth)
│   │   ├── editor/       # CodeMirror theme and highlight styles
│   │   ├── hooks/        # React hooks (useAuth, useAutoSave, useCodeMirror, useSearch)
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
├── scripts/              # Seed password script
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
| `POST` | `/api/backup/sftp/run` | Run an SFTP backup immediately |

## Deployment (Railway)

1. Create a new Railway project with a PostgreSQL add-on
2. Add a web service pointing to this repo
3. Set environment variables: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_PASSWORD`, `NODE_ENV=production`
4. Railway will build using the Dockerfile and run migrations on startup
5. Configure your custom domain in Railway settings

## Daily SFTP Backups

You can enable automatic daily backups to an SFTP folder on your own server. The uploaded ZIP uses the same markdown export as the in-app `Download Backup` feature, preserving your notebook folder structure. You can also test the upload from Settings with `Run SFTP Backup Now`.

Set these environment variables:
- `BACKUP_ENABLED=true`
- `BACKUP_CRON=0 2 * * *`
- `BACKUP_TIMEZONE=Europe/London`
- `BACKUP_SFTP_HOST=...`
- `BACKUP_SFTP_PORT=22`
- `BACKUP_SFTP_USERNAME=...`
- `BACKUP_SFTP_PASSWORD=...`
- `BACKUP_SFTP_REMOTE_DIR=/beijer-ink-backups`

Use an encrypted SFTP endpoint on port `22` when your host supports it.

## License

This project is for personal use. All rights reserved.





