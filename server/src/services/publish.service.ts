import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

// URL slug: lowercase, drop apostrophes (taxman's → taxmans), everything else → hyphen.
function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled'
  );
}

export interface AutofingersPiece {
  slug: string;
  title: string;
  subtitle: string;
  order: number;
  html: string;
  updatedAt: Date;
}

// The published writing feed: every note inside a notebook flagged publishTarget,
// shaped for the static site. Read-only and scoped — no other notes are exposed.
export async function getAutofingersFeed(): Promise<AutofingersPiece[]> {
  const notebooks = await prisma.notebook.findMany({
    where: { publishTarget: true },
    select: { id: true },
  });
  const ids = notebooks.map((n) => n.id);
  if (ids.length === 0) return [];

  const notes = await prisma.note.findMany({
    where: { notebookId: { in: ids } },
    select: { title: true, subtitle: true, slug: true, content: true, sortOrder: true, updatedAt: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const seen = new Set<string>();
  return notes.map((n, i) => {
    const base = slugify((n.slug || '').trim() || n.title);
    let slug = base;
    let k = 2;
    while (seen.has(slug)) slug = `${base}-${k++}`;
    seen.add(slug);
    return {
      slug,
      title: n.title,
      subtitle: (n.subtitle || '').trim(),
      order: n.sortOrder ?? i,
      html: n.content,
      updatedAt: n.updatedAt,
    };
  });
}

// "Publish now": poke the Cloudflare deploy hook so the site rebuilds immediately
// (the build re-fetches this feed). Returns configured:false if no hook is set.
export async function triggerPublish(): Promise<{ configured: boolean; ok?: boolean; status?: number }> {
  const hook = config.cloudflareDeployHook;
  if (!hook) return { configured: false };
  const res = await fetch(hook, { method: 'POST' });
  return { configured: true, ok: res.ok, status: res.status };
}

// ---------------------------------------------------------------------------
// beijerterm.com — terminology articles
// ---------------------------------------------------------------------------

export interface BeijertermArticle {
  slug: string;
  title: string;
  headword: string;    // primary term (falls back to the note title)
  aliases: string[];   // other terms/spellings that should surface the article
  lang: string;        // ISO 639-1 language code, e.g. 'nl' ('' if unset)
  domain: string;      // subject/domain tag, e.g. 'mechanical engineering' ('' if unset)
  order: number;
  html: string;        // article body (Tiptap HTML)
  updatedAt: Date;
}

// The published Beijerterm article feed: every note inside a notebook flagged
// publishBeijerterm, shaped for the Beijerterm static-site build. headword +
// aliases (from the note's metadata JSON) are the search terms that surface the
// article; the body is the note's HTML content. Read-only and scoped.
export async function getBeijertermFeed(): Promise<BeijertermArticle[]> {
  const notebooks = await prisma.notebook.findMany({
    where: { publishBeijerterm: true },
    select: { id: true },
  });
  const ids = notebooks.map((n) => n.id);
  if (ids.length === 0) return [];

  const notes = await prisma.note.findMany({
    where: { notebookId: { in: ids } },
    select: {
      title: true,
      slug: true,
      content: true,
      metadata: true,
      sortOrder: true,
      updatedAt: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const seen = new Set<string>();
  return notes.map((n, i) => {
    const meta = (n.metadata ?? {}) as {
      headword?: unknown; aliases?: unknown; lang?: unknown; domain?: unknown;
    };
    const headword = (typeof meta.headword === 'string' ? meta.headword : '').trim() || n.title;
    const aliases = Array.isArray(meta.aliases)
      ? meta.aliases.map((a) => String(a).trim()).filter(Boolean)
      : [];
    const lang = (typeof meta.lang === 'string' ? meta.lang : '').trim();
    const domain = (typeof meta.domain === 'string' ? meta.domain : '').trim();

    const base = slugify((n.slug || '').trim() || headword || n.title);
    let slug = base;
    let k = 2;
    while (seen.has(slug)) slug = `${base}-${k++}`;
    seen.add(slug);

    return {
      slug,
      title: n.title,
      headword,
      aliases,
      lang,
      domain,
      order: n.sortOrder ?? i,
      html: n.content,
      updatedAt: n.updatedAt,
    };
  });
}

// "Publish now" for Beijerterm — pokes the Beijerterm site's own Cloudflare
// deploy hook (separate from autofingers so the two sites rebuild independently).
export async function triggerBeijertermPublish(): Promise<{ configured: boolean; ok?: boolean; status?: number }> {
  const hook = config.beijertermDeployHook;
  if (!hook) return { configured: false };
  const res = await fetch(hook, { method: 'POST' });
  return { configured: true, ok: res.ok, status: res.status };
}
