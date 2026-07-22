import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, FileText, Pencil, Folder, LayoutGrid, Columns3, SquareKanban, AlertCircle } from 'lucide-react';
import { searchNotes } from '../../api/search';
import type { SearchResult } from '../../types/search';

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (result: SearchResult, query: string) => void;
}

const PAGE_SIZE = 20;

function ResultIcon({ result }: { result: SearchResult }) {
  const className = 'w-4 h-4 text-ink-faint mt-0.5 shrink-0';
  switch (result.type) {
    case 'scratchpad': return <Pencil className={className} />;
    case 'notebook': return <Folder className={className} />;
    case 'board': return <LayoutGrid className={className} />;
    case 'column': return <Columns3 className={className} />;
    case 'card': return <SquareKanban className={className} />;
    default: return <FileText className={className} />;
  }
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-mark-bg text-mark-text rounded-sm px-0.5">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

export function GlobalSearchDialog({ isOpen, onClose, onSelectResult }: GlobalSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setTotal(0);
      setError(false);
    }
  }, [isOpen]);

  const doSearch = useCallback(async (q: string, offset = 0, append = false) => {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      setError(false);
      return;
    }

    append ? setLoadingMore(true) : setLoading(true);
    setError(false);
    try {
      const data = await searchNotes({ q, limit: PAGE_SIZE, offset });
      setResults((current) => append ? [...current, ...data.results] : data.results);
      setTotal(data.total);
    } catch {
      if (!append) setResults([]);
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-surface border border-edge rounded-xl shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-edge">
          <Search className="w-5 h-5 text-ink-faint" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, folders, boards and cards…"
            className="flex-1 bg-transparent text-base text-ink placeholder:text-placeholder focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-ink-faint hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block text-xs text-ink-muted bg-muted-bg px-1.5 py-0.5 rounded border border-edge">ESC</kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {loading && <div className="px-4 py-8 text-center text-ink-muted">Searching…</div>}

          {!loading && error && (
            <div className="px-4 py-8 text-center text-danger">
              <AlertCircle className="w-5 h-5 mx-auto mb-2" />
              Search could not be completed. Please try again.
            </div>
          )}

          {!loading && !error && results.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => {
                onSelectResult(result, query);
                onClose();
              }}
              className="w-full text-left px-4 py-3 hover:bg-hover transition-colors border-b border-edge-soft"
            >
              <div className="flex items-start gap-2">
                <ResultIcon result={result} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-ink truncate">
                    <HighlightedText text={result.title} query={query} />
                  </h4>
                  <p className="text-xs text-ink-muted mt-0.5">{result.context}</p>
                  {result.headline && (
                    <p className="text-xs text-ink-muted mt-1 line-clamp-2">
                      <HighlightedText text={result.headline} query={query} />
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}

          {!loading && !error && total > results.length && (
            <button
              onClick={() => doSearch(query, results.length, true)}
              disabled={loadingMore}
              className="w-full px-4 py-3 text-sm text-accent hover:bg-hover disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : `Show more (${results.length} of ${total})`}
            </button>
          )}

          {!loading && !error && query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-ink-muted">No results found for “{query}”</div>
          )}

          {!loading && !query.trim() && (
            <div className="px-4 py-8 text-center text-ink-muted text-sm">
              Finds complete words, partial words, codes and number strings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
