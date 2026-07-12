import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookMarked, ExternalLink, Check, Loader2 } from 'lucide-react';
import { updateNote } from '../../api/notes';
import { publishBeijerterm } from '../../api/notebooks';
import type { Note, NoteMetadata } from '../../types/note';

const SITE = 'https://beijerterm.com';

// Mirror of the server's slugify (publish.service.ts) so the "view live" link
// previews the same URL the build will generate.
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

// Shown above the editor when a note lives in a notebook flagged "Publish to
// beijerterm". Lets you set the terminology metadata that drives search
// surfacing (headword, aliases, language, domain), override the URL slug, jump
// to the live article, and trigger an immediate rebuild.
export function BeijertermPublishPanel({ note }: { note: Note }) {
  const queryClient = useQueryClient();
  const meta = note.metadata ?? {};
  const [headword, setHeadword] = useState(meta.headword ?? '');
  const [aliases, setAliases] = useState((meta.aliases ?? []).join(', '));
  const [lang, setLang] = useState(meta.lang ?? '');
  const [domain, setDomain] = useState(meta.domain ?? '');
  const [slug, setSlug] = useState(note.slug ?? '');

  // Reset fields when switching to a different note.
  useEffect(() => {
    const m = note.metadata ?? {};
    setHeadword(m.headword ?? '');
    setAliases((m.aliases ?? []).join(', '));
    setLang(m.lang ?? '');
    setDomain(m.domain ?? '');
    setSlug(note.slug ?? '');
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMetaMutation = useMutation({
    mutationFn: (metadata: NoteMetadata) => updateNote(note.id, { metadata }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note', note.id] }),
  });
  const saveSlugMutation = useMutation({
    mutationFn: (body: { slug?: string | null }) => updateNote(note.id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note', note.id] }),
  });

  const publishMutation = useMutation({ mutationFn: publishBeijerterm });

  const effectiveSlug = slugify((slug || '').trim() || headword.trim() || note.title);
  const liveUrl = `${SITE}/article/${effectiveSlug}`;

  // Build the metadata object from current field state and persist it.
  const saveMeta = () => {
    const next: NoteMetadata = {
      headword: headword.trim(),
      aliases: aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      lang: lang.trim(),
      domain: domain.trim(),
    };
    const prev: NoteMetadata = {
      headword: (meta.headword ?? '').trim(),
      aliases: meta.aliases ?? [],
      lang: (meta.lang ?? '').trim(),
      domain: (meta.domain ?? '').trim(),
    };
    if (JSON.stringify(next) !== JSON.stringify(prev)) saveMetaMutation.mutate(next);
  };
  const saveSlug = () => {
    const v = slug.trim();
    if (v !== (note.slug ?? '')) saveSlugMutation.mutate({ slug: v || null });
  };

  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 border-b border-edge bg-accent/5">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-accent shrink-0">
        <BookMarked className="w-3.5 h-3.5" /> beijerterm
      </span>

      <label className="flex items-center gap-1.5 text-xs text-ink-faint">
        Headword
        <input
          value={headword}
          onChange={(e) => setHeadword(e.target.value)}
          onBlur={saveMeta}
          onKeyDown={blurOnEnter}
          placeholder={note.title}
          className="w-40 max-w-[30vw] px-2 py-1 text-sm bg-surface border border-edge rounded text-ink placeholder:text-ink-dim focus:outline-none focus:border-accent"
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-ink-faint">
        Aliases
        <input
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          onBlur={saveMeta}
          onKeyDown={blurOnEnter}
          placeholder="axle, shaft, axis"
          title="Comma-separated terms that also surface this article in search"
          className="w-56 max-w-[40vw] px-2 py-1 text-sm bg-surface border border-edge rounded text-ink placeholder:text-ink-dim focus:outline-none focus:border-accent"
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-ink-faint">
        Lang
        <input
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          onBlur={saveMeta}
          onKeyDown={blurOnEnter}
          placeholder="nl"
          title="Article language (ISO 639-1)"
          className="w-14 px-2 py-1 text-sm bg-surface border border-edge rounded text-ink placeholder:text-ink-dim focus:outline-none focus:border-accent"
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-ink-faint">
        Domain
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onBlur={saveMeta}
          onKeyDown={blurOnEnter}
          placeholder="mechanical engineering"
          title="Subject tag shown on the search card"
          className="w-44 max-w-[32vw] px-2 py-1 text-sm bg-surface border border-edge rounded text-ink placeholder:text-ink-dim focus:outline-none focus:border-accent"
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-ink-faint">
        Slug
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onBlur={saveSlug}
          onKeyDown={blurOnEnter}
          placeholder={slugify(headword || note.title)}
          className="w-40 max-w-[30vw] px-2 py-1 text-sm font-mono bg-surface border border-edge rounded text-ink placeholder:text-ink-dim focus:outline-none focus:border-accent"
        />
      </label>

      <a
        href={liveUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-accent"
        title={liveUrl}
      >
        <ExternalLink className="w-3.5 h-3.5" /> view live
      </a>

      <button
        onClick={() => publishMutation.mutate()}
        disabled={publishMutation.isPending}
        title="Rebuild beijerterm.com now (otherwise it updates on the next build)"
        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded bg-accent text-white hover:opacity-90 disabled:opacity-60 shrink-0"
      >
        {publishMutation.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : publishMutation.isSuccess ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <BookMarked className="w-3.5 h-3.5" />
        )}
        {publishMutation.isPending
          ? 'Publishing…'
          : publishMutation.isSuccess
          ? 'Triggered'
          : publishMutation.isError
          ? 'Retry publish'
          : 'Publish now'}
      </button>
    </div>
  );
}
