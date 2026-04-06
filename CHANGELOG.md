# Changelog

All notable changes to Beijer.ink will be documented in this file.

This project uses [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`
- **MAJOR** — Breaking changes (API, database schema)
- **MINOR** — New features, non-breaking enhancements
- **PATCH** — Bug fixes, small improvements

Current Version: **0.19.2**

---

## [0.19.2] — 2026-04-06

### Changed
- **Centered editor layout** — note content is now centered with a max-width of 850px (like Evernote), with more generous padding, instead of stretching edge-to-edge on wide screens. Applies to normal notes, large block-mode notes, and the scratchpad

---

## [0.19.1] — 2026-04-01

### Added
- **Mobile overflow menu** — Action buttons (TOC, toolbar toggle, pin, delete) collapse into a kebab (`...`) menu on mobile, keeping the toolbar on a single compact line
- **Scratchpad in global search** — Scratchpad content is now included in search results with a pencil icon; clicking navigates to the scratchpad and highlights matches

### Changed
- **Merged toolbar and action bar** — Formatting buttons and action buttons now share a single row on desktop instead of two separate bars
- **Ctrl+K opens search** — The keyboard shortcut now toggles the search dialog open/closed (previously could only close it)

### Fixed
- **Mobile search dialog overflow** — Search dialog no longer extends off-screen on narrow Android viewports; added `px-4` container padding
- **Mobile auto-zoom on input focus** — Set search input to `text-base` (16px) and locked viewport with `maximum-scale=1` to prevent Chrome auto-zoom
- **Mobile layout overflow** — Removed the 118% root font-size scaling that was making the entire mobile layout 18% wider than the viewport
- **Search indexing HTML tags** — `to_tsvector` now strips HTML tags before indexing, fixing patchy search results
- **Search highlight in scratchpad** — Clicking a scratchpad search result now highlights and navigates to the match

---

## [0.19.0] — 2026-04-01

### Added
- **Table of contents panel** — Auto-generated sidebar listing all headings (h1–h3) with indentation; click any heading to jump to it; works in both normal and block mode; toggle via the tree icon in the action bar
- **Table context menu** — Right-click inside any table for row/column operations: add/delete rows and columns, toggle header row, merge/split cells, delete table
- **Scratchpad toolbar** — The scratchpad now has the same formatting toolbar as the note editor, toggled via the Type button in the header

### Changed
- **Toolbar visible by default** — The formatting toolbar now shows by default for new users (existing preference preserved)

### Fixed
- **Search highlight accuracy** — In-editor search decorations now highlight the correct text; rewrote position mapping to walk ProseMirror document nodes instead of using `textBetween()`

### Improved
- **Large table performance** — Blocks over 20KB (e.g. large tables) defer serialization to block deactivation instead of every keystroke, keeping typing responsive

---

## [0.18.0] — 2026-03-31

### Added
- **WYSIWYG editor** — Replaced the CodeMirror Markdown editor with Tiptap, a ProseMirror-based rich text editor; bold text looks bold, headings look like headings, tables are visual grids — no Markdown syntax required
- **Block-level editing for large documents** — Notes over 50KB render as fast static HTML; clicking any block (paragraph, heading, table, etc.) activates just that block in a live Tiptap editor, avoiding browser freezes on very large documents
- **Rich table editing** — Insert, resize, and edit tables with full cell-by-cell WYSIWYG; add/remove rows and columns via toolbar or right-click
- **Task lists** — Checkbox-based task lists with nested indentation support
- **Underline formatting** — New toolbar button and keyboard shortcut (Ctrl+U)
- **Active formatting indicators** — Toolbar buttons highlight to show which formats are active at the cursor position
- **Migration script** — `server/scripts/migrate-md-to-html.ts` converts existing Markdown notes to HTML (one-time run)

### Changed
- **Storage format** — Notes and scratchpad now stored as HTML instead of Markdown; PostgreSQL `to_tsvector` natively strips HTML for full-text search
- **Backup export** — Downloaded backups now contain `.html` files (with inline styles) instead of `.md` files
- **Search excerpts** — `ts_headline` now strips HTML tags before generating highlighted snippets
- **Title extraction** — Server-side title extraction uses HTML-aware regex instead of first-line-of-markdown

### Removed
- CodeMirror 6 editor and all `@codemirror/*` packages
- `react-markdown` and `remark-gfm` (Markdown preview)
- Markdown cheat sheet dialog
- Edit/Preview/Split view mode toggle

---

## [0.17.0] — 2026-03-21

### Added
- **Favourites** — Pin folders or notes to a new "Favourites" section at the top of the sidebar via right-click context menu; unpin with "Remove from Favourites"
- **Sidebar drag-and-drop** — Notes and folders can now be dragged in and out of folders directly in the sidebar tree, with drop indicators showing where items will land
- **Section headings** — Sidebar now shows colour-coded "Favourites", "Folders", and "Notes" headings to visually separate the three areas
- **`isFavorite` fields** — Added to both Note and Notebook database models to persist pin state

### Changed
- "Notes" heading now always appears above root-level notes (previously only shown when folders also existed)
- All user-facing strings use UK English spelling ("Favourites")

---

## [0.16.0] — 2026-03-09

### Added
- **Multi-theme system** — 5 themes: Light, Dark, Rose (warm cream/terracotta), Lavender (cool purple), and Mint (green/teal)
- **Theme picker** — Popover in sidebar footer with color swatches for each theme; replaces the old light/dark toggle
- **CSS custom property architecture** — ~40 semantic color tokens (`bg-surface`, `text-ink`, `border-edge`, `text-accent`, etc.) power all 5 themes via Tailwind CSS 4's `@theme` directive
- **Per-theme CodeMirror syntax highlighting** — Each theme has its own syntax color palette for the markdown editor
- **Tree-structured "Move to" submenu** — Notebook context menus now show the full notebook hierarchy with indentation
- **Indent guide midpoint stops** — Dashed guide lines stop at the vertical center of the last item at each depth level

### Changed
- All 23 component files refactored from `dark:` class pairs to single semantic token classes, simplifying every component
- Theme preference stored as `data-theme` attribute on `<html>` instead of a `.dark` class
- `ThemeContext` exports `setTheme(theme)` instead of `toggleTheme()`

### Removed
- `@custom-variant dark` directive and all `dark:` CSS class usage
- Sun/Moon toggle button from sidebar footer

---

## [0.15.0] — 2026-03-09

### Added
- **Google Drive automatic backups** — Daily backups uploaded to Google Drive using OAuth2 refresh token flow (replaces the previous SFTP and service-account approaches which both had blockers)
- **One-time auth setup script** (`scripts/google-drive-auth.ts`) — Starts a local server, handles OAuth callback, and prints the refresh token for Railway
- **Manual Google Drive backup** — "Run Google Drive Backup Now" button in Settings triggers an immediate upload
- **Scratchpad in backups** — The scratchpad content is now included as `Scratchpad.md` at the root of backup archives
- **Sidebar indent guides** — Dashed vertical lines at each depth level show the notebook/note hierarchy

### Removed
- SFTP backup system (`ssh2-sftp-client` dependency and all SFTP config)

### Setup required
- Set `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, and optionally `GOOGLE_DRIVE_FOLDER_ID`
- Run `npx tsx scripts/google-drive-auth.ts` once locally to obtain the refresh token

---

## [0.14.0] — 2026-03-08

### Added
- Automatic daily SFTP backups with configurable cron schedule
- Manual "Run SFTP Backup Now" action in Settings
- `POST /api/backup/sftp/run` endpoint for on-demand SFTP backup uploads
- GitHub repository link in sidebar footer and login page

### Changed
- Backup filenames are now generated from a shared helper so manual downloads and uploads stay aligned

---

## [0.13.1] — 2026-02-28

### Fixed
- Switched email transport from Gmail SMTP (nodemailer) to **Resend** HTTP API — Railway blocks outbound SMTP traffic
- Enabled Express `trust proxy` for correct rate limiting behind Railway's reverse proxy

### Changed
- Environment variables simplified: `GMAIL_USER` + `GMAIL_APP_PASSWORD` replaced by single `RESEND_API_KEY`

---

## [0.13.0] — 2026-02-28

### Added
- **Password reset via email** — "Forgot password?" link on login page sends a reset email via Resend
- **Forgot password page** (`/forgot-password`) — Enter email, receive a reset link; generic success message prevents email enumeration
- **Reset password page** (`/reset-password/:token`) — Set a new password using a time-limited token (1 hour); auto-redirects to login on success
- `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` endpoints
- Rate limiting on reset requests (3 per 15 minutes)
- `resetToken` and `resetExpires` fields on User model

### Setup required
- Set `RESEND_API_KEY`, `ADMIN_EMAIL`, and `APP_URL` environment variables on Railway

---

## [0.12.0] — 2026-02-28

### Added
- **Download backup** — Settings → Data → "Download Backup" exports all notes as individual `.md` files in a zip archive, preserving the notebook folder hierarchy
- `GET /api/backup/download` endpoint streams a zip archive with `archiver`

### Changed
- **Collapsible settings sections** — Password change is now a collapsible row with icon, title, and description; click to expand the form

---

## [0.11.0] — 2026-02-28

### Added
- **Table insert** — Markdown toolbar button to insert a 3-column table template
- **Markdown cheat sheet** — Built-in reference guide accessible via help icon in the toolbar, covering text formatting, headings, lists, blocks, tables, and more
- **Clickable app title** — Clicking "Beijer.ink" in the sidebar header refreshes the page

### Changed
- **Settings dialog refactored** — Now a proper settings area with scrollable sections; password change moved to its own `ChangePasswordSection` component, making it easy to add future settings sections

---

## [0.10.0] — 2026-02-28

### Added
- **Settings dialog** — Accessible via gear icon in the sidebar footer, opens a modal overlay
- **Change password** — Settings dialog includes a password change form with current/new/confirm fields, client-side validation (min 8 chars, match confirmation), and server-side verification
- `PUT /api/auth/password` endpoint with Zod validation and bcrypt hashing

---

## [0.9.1] — 2026-02-27

### Fixed
- Editor no longer auto-focuses on touch devices, preventing the keyboard from popping up immediately when opening a note on mobile

---

## [0.9.0] — 2026-02-27

### Changed
- **Unified mobile/desktop sidebar** — Mobile now uses the same inline-notes sidebar as desktop; tapping a notebook expands it to show notes inline, tapping a note opens the editor
- Removed the separate NoteListPanel screen on mobile
- Mobile bottom nav simplified to 2 tabs (Notebooks / Editor) instead of 3
- Notebook clicks no longer close the mobile sidebar overlay — only note selection does

### Removed
- `NoteListPanel` import from mobile layout (kept in codebase for potential future use)
- "Notes" tab from mobile bottom navigation

---

## [0.8.2] — 2026-02-27

### Fixed
- Clicking a notebook on mobile now navigates to the note list instead of closing the sidebar without action

---

## [0.8.1] — 2026-02-27

### Fixed
- Bold text inside lists and blockquotes now renders at full brightness instead of inheriting the dimmer list/quote color

---

## [0.8.0] — 2026-02-27

### Added
- **Inline notes in sidebar** — Expanding a notebook now shows its notes directly in the sidebar tree (like a file explorer), eliminating the separate note list panel on desktop
- **New note from notebook menu** — Right-click a notebook and choose "New note" to create a note inside it
- **Note context menu in sidebar** — Right-click notes in the tree to move them between notebooks or delete them
- **Resizable sidebar** — Drag the divider between sidebar and editor to resize (180–400px range, persisted to localStorage)

### Changed
- Desktop layout reduced from 3 columns (sidebar + note list + editor) to 2 columns (sidebar + editor)
- Sidebar tree now renders a discriminated union of notebook and note nodes with lazy-loaded notes per expanded notebook
- Keyboard navigation (Arrow keys, Home/End, Enter) works across both notebooks and notes in the tree
- ArrowLeft on a note navigates to its parent notebook; ArrowRight on notes is a no-op

---

## [0.7.0] — 2026-02-27

### Added
- **Root-level notes** — Notes can now exist outside of any notebook, appearing as individual items in the sidebar below the notebook tree
- **New note button** — FilePlus button in the sidebar header creates a root-level note instantly
- **Root note context menu** — Right-click to move a root note into a notebook or delete it
- **In-editor search highlighting** — Clicking a global search result highlights all matches in the editor with a floating navigation bar (arrow keys or prev/next buttons to jump between matches)

### Changed
- `notebookId` is now optional in the database schema — notes without a notebook are stored with `NULL` notebook_id
- Search uses `LEFT JOIN` so root notes appear in global search results (shown as "Root")
- Search highlight bar auto-focuses on mount so arrow keys work immediately

---

## [0.6.0] — 2026-02-26

### Added
- **CodeMirror 6 editor** — Notes and scratchpad now use CodeMirror 6 with inline markdown styling: bold text appears bold, headers are larger, code is highlighted, and markup characters (`**`, `##`, `` ` ``) remain visible but dimmed
- **Markdown toolbar** — Toggleable formatting toolbar with buttons for bold, italic, strikethrough, headings (H1–H3), inline code, links, bullet/ordered lists, blockquotes, and horizontal rules; toolbar state persisted in localStorage
- **Fullscreen mode** — Expand the note editor to fill the entire page (hides sidebar and note list); exit with Escape or the minimize button

### Changed
- Note list panel is hidden when no notebook is selected, giving the scratchpad more room on initial load
- Scratchpad uses monospace font to match the note editor

### Fixed
- Move to submenu no longer clipped by sidebar overflow — changed from right-flyout to inline expandable list
- Space bar and arrow keys now work correctly when renaming notebooks in the sidebar

---

## [0.5.1] — 2026-02-25

### Changed
- Notebook drag-and-drop removed (was unreliable); notebooks are now moved via right-click context menu "Move to" submenu
- Sidebar restyled to be more Obsidian-like: tighter spacing, subtler selection, folder open/closed icons, muted colors
- Context menu now includes "New sub-notebook" option to create child notebooks inline

### Removed
- Notebook dragging (useDraggable) and root drop zone; note-to-notebook drag-and-drop is preserved
- `SidebarDropRoot` component

---

## [0.5.0] — 2026-02-25

### Changed
- Editor replaced: TipTap WYSIWYG removed, replaced with plain `<textarea>` and monospace font
- First line of note content is now the title (no separate title field)
- Title auto-derived on server from first line of content
- Note list preview shows lines 2+ of content (line 1 is the title)
- Tab key inserts 2 spaces instead of moving focus
- Search uses inline tsvector on content (no stored search_vector column)

### Removed
- TipTap editor and all 22 extension packages
- Formatting toolbar, table menu, find & replace, image resize
- Tag system (TagPicker, TagBadge, Tag/NoteTag database tables)
- Image upload and Cloudflare R2 integration (Image table dropped)
- `plainText` database column (content is now plain text directly)
- `@aws-sdk/client-s3`, `html-to-text`, `multer` server packages
- `@tailwindcss/typography` plugin and ~180 lines of TipTap CSS
- Client bundle reduced from 860KB to 395KB

---

## [0.4.0] — 2026-02-24

### Added
- Drag-and-drop notebooks into other notebooks to create nested folder hierarchies
- Drag notebooks to root drop zone to un-nest them back to top level
- Drag notes from the note list onto sidebar notebooks to move between notebooks
- Full keyboard navigation for notebook tree (Arrow keys to move, Left/Right to collapse/expand, Home/End to jump, Enter to select)
- Full keyboard navigation for note list (Arrow keys to move, Home/End to jump, Enter to select)
- Touch drag support for Android (press-and-hold 200ms to start dragging)
- Drag overlay preview showing notebook/note name while dragging
- Circular reparenting prevention (can't drop a notebook into its own descendant)

### Fixed
- Auto-save stale closure: editor body edits no longer overwrite the title back to its initial value
- Content now reliably persists when switching between notes (pending saves are flushed on note switch)
- `setContent` during note loading no longer triggers spurious auto-saves to the wrong note
- Title changes in the editor now update the note list instantly (optimistic cache update)
- Title-only changes are no longer silently dropped by the debounce dedup logic
- New note creation appears instantly via optimistic update (no page refresh needed)
- Stuck browser focus ring no longer appears on notebooks and notes after clicking

### Changed
- Sidebar notebook tree refactored from recursive rendering to flat list for dnd-kit hook compatibility
- Keyboard arrow navigation immediately selects the focused item (no separate focus vs selection)

---

## [0.3.0] — 2026-02-24

### Added
- Scratchpad: instant-access plain textarea shown on app load when no note is selected
- Auto-saves scratchpad content with 1-second debounce, persisted in PostgreSQL
- New API endpoints: `GET /api/scratchpad` and `PUT /api/scratchpad`
- Mobile bottom nav shows "Scratchpad" tab label when no note is open

### Changed
- Mobile default view now opens to scratchpad instead of notebook sidebar
- Editor tab in mobile nav is always enabled (shows scratchpad or note editor)

---

## [0.2.1] — 2026-02-24

### Changed
- Consolidated Railway deployment: app and PostgreSQL database now in a single project
- Database connection uses Railway private networking for lower latency and zero egress costs

---

## [0.2.0] — 2026-02-24

### Added
- Light mode theme with clean white/slate color palette
- Theme toggle button in sidebar footer (Sun/Moon icon) to switch between light and dark mode
- Theme preference persisted to localStorage across sessions
- Tailwind CSS 4 `dark:` variant support via custom selector strategy

### Changed
- All 11 UI components updated with dual light/dark theme classes
- Custom CSS (code blocks, tables, blockquotes, links, scrollbars) now adapts to active theme
- Editor prose styling switches between `prose` (light) and `prose-invert` (dark) automatically
- Default theme remains dark mode for existing users

---

## [0.1.0] — 2026-02-23

Initial release with core note-taking functionality.

### Added
- Single-user authentication with bcrypt password hashing and JWT tokens (30-day expiry)
- Rate-limited login endpoint (5 attempts per minute)
- Notebook CRUD with hierarchical tree structure (parent/child notebooks)
- Note CRUD with rich HTML content storage
- TipTap WYSIWYG editor with 20+ extensions:
  - Text formatting (bold, italic, underline, strikethrough, highlight, colors)
  - Block types (headings, blockquotes, code blocks, horizontal rules)
  - Lists (bullet, ordered, task lists with checkboxes)
  - Tables with row/column management and header support
  - Links, subscript, superscript, text alignment
  - Image insertion with resizable drag handles
  - Typography auto-corrections
  - Character count
- In-document search and replace (Ctrl+F)
- Auto-save with 1-second debounce
- PostgreSQL full-text search with weighted tsvector (title=A, content=B) and GIN index
- Global search with `ts_rank` ordering and `ts_headline` highlighted snippets
- Tag system with colors and many-to-many note associations
- Tag picker with autocomplete and inline tag creation
- Image upload via paste/toolbar with Cloudflare R2 storage
- Responsive 3-column layout (sidebar, note list, editor)
- Mobile-optimized single-column view with bottom tab navigation
- PWA manifest and service worker for Android "Add to Home Screen"
- Docker multi-stage build for Railway deployment
- Prisma ORM with PostgreSQL migrations
- Zod request validation on all mutation endpoints
- Async error handling middleware for Express
- Helmet security headers and CORS configuration


