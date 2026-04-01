import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, FileText, Pencil } from 'lucide-react';
import { searchNotes } from '../../api/search';
import type { SearchResult } from '../../types/search';

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNote: (noteId: string, query: string) => void;
}

export function GlobalSearchDialog({ isOpen, onClose, onSelectNote }: GlobalSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setTotal(0);
    }
  }, [isOpen]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const data = await searchNotes({ q, limit: 20 });
      setResults(data.results);
      setTotal(data.total);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-xl bg-surface border border-edge rounded-xl shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-edge">
          <Search className="w-5 h-5 text-ink-faint" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all notes..."
            className="flex-1 bg-transparent text-ink placeholder:text-placeholder focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-ink-faint hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block text-xs text-ink-muted bg-muted-bg px-1.5 py-0.5 rounded border border-edge">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-ink-muted">Searching...</div>
          )}

          {!loading && results.length > 0 && (
            <>
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => {
                    onSelectNote(result.id, query);
                    onClose();
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-hover transition-colors border-b border-edge-soft"
                >
                  <div className="flex items-start gap-2">
                    {result.id === '__scratchpad__' ? (
                      <Pencil className="w-4 h-4 text-ink-faint mt-0.5 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-ink-faint mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-ink truncate">{result.title}</h4>
                      <p className="text-xs text-ink-muted mt-0.5">{result.notebookName || 'Root'}</p>
                      <p
                        className="text-xs text-ink-muted mt-1 line-clamp-2 [&_mark]:bg-mark-bg [&_mark]:text-mark-text [&_mark]:rounded-sm [&_mark]:px-0.5"
                        dangerouslySetInnerHTML={{ __html: result.headline }}
                      />
                    </div>
                  </div>
                </button>
              ))}
              {total > results.length && (
                <div className="px-4 py-2 text-xs text-ink-muted text-center">
                  Showing {results.length} of {total} results
                </div>
              )}
            </>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-ink-muted">
              No results found for "{query}"
            </div>
          )}

          {!loading && !query.trim() && (
            <div className="px-4 py-8 text-center text-ink-muted text-sm">
              Type to search across all your notes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
