import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UploadCloud, ExternalLink, Check, Loader2 } from 'lucide-react';
import { updateNote } from '../../api/notes';
import { publishAutofingers } from '../../api/notebooks';
import type { Note } from '../../types/note';

const SITE = 'https://autofingers.com';

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
// autofingers". Lets you set the kicker (subtitle), override the URL slug, jump
// to the live page, and trigger an immediate rebuild.
export function PublishPanel({ note }: { note: Note }) {
  const queryClient = useQueryClient();
  const [subtitle, setSubtitle] = useState(note.subtitle ?? '');
  const [slug, setSlug] = useState(note.slug ?? '');

  // Reset fields when switching to a different note
  useEffect(() => {
    setSubtitle(note.subtitle ?? '');
    setSlug(note.slug ?? '');
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: (body: { subtitle?: string | null; slug?: string | null }) => updateNote(note.id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note', note.id] }),
  });

  const publishMutation = useMutation({ mutationFn: publishAutofingers });

  const effectiveSlug = slugify((slug || '').trim() || note.title);
  const liveUrl = `${SITE}/writing/${effectiveSlug}`;

  const saveSubtitle = () => {
    const v = subtitle.trim();
    if (v !== (note.subtitle ?? '')) saveMutation.mutate({ subtitle: v || null });
  };
  const saveSlug = () => {
    const v = slug.trim();
    if (v !== (note.slug ?? '')) saveMutation.mutate({ slug: v || null });
  };

  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 border-b border-edge bg-accent/5">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-accent shrink-0">
        <UploadCloud className="w-3.5 h-3.5" /> autofingers
      </span>

      <label className="flex items-center gap-1.5 text-xs text-ink-faint">
        Subtitle
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          onBlur={saveSubtitle}
          onKeyDown={blurOnEnter}
          placeholder="straight from the source"
          className="w-56 max-w-[40vw] px-2 py-1 text-sm bg-surface border border-edge rounded text-ink placeholder:text-ink-dim focus:outline-none focus:border-accent"
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-ink-faint">
        Slug
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onBlur={saveSlug}
          onKeyDown={blurOnEnter}
          placeholder={slugify(note.title)}
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
        title="Rebuild autofingers.com now (otherwise it updates on the daily sync)"
        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded bg-accent text-white hover:opacity-90 disabled:opacity-60 shrink-0"
      >
        {publishMutation.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : publishMutation.isSuccess ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <UploadCloud className="w-3.5 h-3.5" />
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
