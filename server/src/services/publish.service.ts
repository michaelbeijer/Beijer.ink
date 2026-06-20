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
