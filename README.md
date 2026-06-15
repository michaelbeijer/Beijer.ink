# Beijer.ink

A personal, self-hosted **notes + planning** web app. Rich-text notes live in nested notebooks with full-text search, and the same workspace doubles as a planner: Trello-style **boards** whose cards can be viewed as a **Kanban**, **Calendar**, **Table**, or **List** — different lenses on one set of data. Built for a single user, installable as a PWA, and comfortable on desktop and phone.

<img width="1509" alt="Beijer.ink" src="https://github.com/user-attachments/assets/3136f331-db0a-4742-ab1b-78b425995bd8" />

## Features

### Notes
- **WYSIWYG editor** (Tiptap/ProseMirror) — bold looks bold, headings look like headings, tables are real grids, task lists have checkboxes. No Markdown syntax to remember.
- **Block-level editing** — large documents render as fast static HTML; clicking a block activates just that block in a live editor, so 50 KB+ notes never freeze the browser.
- **Formatting toolbar**, **auto-generated table of contents**, **table editing** (right-click for rows/columns/merge), and a distraction-free **fullscreen** mode.
- **Auto-save** with a 1-second debounce.

### Organising
- **Notebooks** — a hierarchical tree; right-click to move, rename, or create sub-notebooks.
- **Root notes** — notes that live outside any notebook.
- **Favourites** — pin notebooks, notes, or boards to the top of the sidebar.
- **Drag-and-drop** — move notes and notebooks around the tree directly.
- **Scratchpad** — an always-available editor for quick jotting, open on load.

### Boards & views
- **Boards** are a top-level item alongside notebooks: lists (columns) of cards with **drag-and-drop** reordering of both cards and lists.
- **Cards** carry a title, rich description, **labels**, a **date**, a **done** state, and a **checklist** — and can **link to a note** (create one from a card, or attach an existing note and open it in the editor).
- **Four views over the same cards** (switching view never changes the data):
  - **Kanban** — group by your free-form **lists**, or by **week** (auto columns derived from each card's date, plus "No date" and "Done").
  - **Calendar** — **Monthly** grid, or **Weekly**; on phones the weekly view becomes an at-a-glance density strip + day-card grid with a mini-month.
  - **Table** — an editable spreadsheet of every card.
  - **List** — an agenda grouped by Overdue / Today / This week / Later / No date.
- **Two-way sync** — dragging a card to another day in the Calendar moves it to the matching week column in the Kanban, and vice versa, because every view reads and writes the same fields.

### Everything else
- **Global search** — weighted PostgreSQL full-text search (title boosted over body) with highlighted snippets; the scratchpad is searchable too. `Ctrl/Cmd-K` to open.
- **Images** — paste/upload images, stored in Cloudflare R2.
- **5 themes** — Light, Dark, Rose, Lavender, Mint; remembered across sessions.
- **PWA** — installable on Android via "Add to Home Screen".
- **Backups** — a daily SFTP backup (a ZIP of all notes as Markdown, preserving notebook folders) plus an on-demand backup download from Settings.
- **Responsive** — 3-column desktop, 2-column tablet, single-column mobile with bottom navigation.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, Tiptap, Tailwind CSS 4, TanStack Query, dnd-kit |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL via Prisma; full-text search (tsvector + GIN) |
| Storage | Cloudflare R2 (images) |
| Auth | Single password (bcrypt) + JWT |
| Deployment | Docker on Railway |

## Getting started

**Prerequisites:** Node.js 22+ and a PostgreSQL database (local or hosted).

```bash
git clone https://github.com/michaelbeijer/beijer.ink.git
cd beijer.ink
npm install

cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD
cp .env server/.env           # Prisma reads it from here

npm run db:migrate            # apply the schema
npm run seed                  # set the admin password from ADMIN_PASSWORD
npm run dev                   # client → http://localhost:5173, API → :3000
```

Open **http://localhost:5173** (the client proxies `/api` to the server).

### Production

```bash
npm run build && npm start
# or
docker build -f server/Dockerfile -t beijer-ink .
docker run -p 3000:3000 --env-file .env beijer-ink
```

### Environment

`DATABASE_URL`, `JWT_SECRET` (64-char hex), `ADMIN_PASSWORD`, optional `R2_*` (image uploads), and optional `BACKUP_*` (daily SFTP backups — see `.env.example`).

## Project structure

```
beijer.ink/
├── client/                # React + Vite frontend
│   └── src/
│       ├── api/           # Axios API wrappers
│       ├── components/    # board/, editor/, layout/, notes/, scratchpad/, search/, settings/
│       ├── hooks/         # data, drag-and-drop, view prefs, media queries
│       ├── utils/         # tree + calendar helpers
│       └── types/
├── server/                # Express API
│   └── src/
│       ├── routes/ controllers/ services/ middleware/ validators/
│       └── prisma/        # schema + migrations
└── Dockerfile
```

## Deployment (Railway)

1. Create a Railway project with a PostgreSQL add-on.
2. Add a web service pointing at this repo (it builds via the Dockerfile).
3. Set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_PASSWORD`, `NODE_ENV=production` (plus `R2_*` / `BACKUP_*` if used).
4. Add your custom domain in Railway settings.

## License

Personal project — all rights reserved.
