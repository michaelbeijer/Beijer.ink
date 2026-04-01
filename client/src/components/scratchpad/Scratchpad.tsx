import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Type } from 'lucide-react';
import { EditorContent } from '@tiptap/react';
import { getScratchpad, updateScratchpad } from '../../api/scratchpad';
import { useTiptap } from '../../hooks/useTiptap';
import { TiptapToolbar } from '../editor/TiptapToolbar';
import { TableMenu } from '../editor/TableMenu';
import { SearchHighlightBar } from '../editor/SearchHighlightBar';

const TOOLBAR_KEY = 'beijer-ink-toolbar';

interface ScratchpadProps {
  searchQuery?: string | null;
  onClearSearch?: () => void;
}

export function Scratchpad({ searchQuery, onClearSearch }: ScratchpadProps) {
  const [charCount, setCharCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSavedRef = useRef<string>('');
  const [showToolbar, setShowToolbar] = useState(() => {
    const stored = localStorage.getItem(TOOLBAR_KEY);
    return stored === null ? true : stored === 'true';
  });
  const [searchBar, setSearchBar] = useState<{ query: string; matchCount: number; currentIndex: number } | null>(null);
  const pendingSearchRef = useRef<string | null>(null);
  const contentLoadedRef = useRef(false);

  const handleChange = useCallback((html: string) => {
    setCharCount(html.length);
    setSearchBar(null);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (html === lastSavedRef.current) return;
      lastSavedRef.current = html;
      try {
        await updateScratchpad(html);
      } catch (err) {
        console.error('Scratchpad auto-save failed:', err);
      }
    }, 1000);
  }, []);

  const { editor, setContent, focus, setSearch, clearSearch, getSearchState, goToMatch, nextMatch, prevMatch } = useTiptap({
    onChange: handleChange,
    placeholder: 'Jot something down...',
  });

  const editorRef = useRef(editor);
  editorRef.current = editor;

  const { data } = useQuery({
    queryKey: ['scratchpad'],
    queryFn: getScratchpad,
  });

  function applyPendingSearch() {
    const query = pendingSearchRef.current;
    if (!query) return;
    pendingSearchRef.current = null;

    queueMicrotask(() => {
      setSearch(query);
      const state = getSearchState();
      setSearchBar({
        query,
        matchCount: state.matches.length,
        currentIndex: state.currentIndex,
      });
      if (state.matches.length > 0) {
        goToMatch(0);
      }
    });
  }

  // Stash incoming search query
  useEffect(() => {
    if (searchQuery) {
      pendingSearchRef.current = searchQuery;
      if (contentLoadedRef.current) {
        applyPendingSearch();
      }
    }
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved content
  useEffect(() => {
    if (data && editor) {
      setContent(data.content);
      setCharCount((data.content || '').length);
      lastSavedRef.current = data.content;
      contentLoadedRef.current = true;
      applyPendingSearch();
    }
  }, [data, editor, setContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus on mount
  useEffect(() => {
    if (editor) setTimeout(() => focus(), 50);
  }, [editor, focus]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const toggleToolbar = useCallback(() => {
    setShowToolbar((prev) => {
      const next = !prev;
      localStorage.setItem(TOOLBAR_KEY, String(next));
      return next;
    });
  }, []);

  const handleDismissSearch = useCallback(() => {
    clearSearch();
    setSearchBar(null);
    onClearSearch?.();
  }, [clearSearch, onClearSearch]);

  const handleNextMatch = useCallback(() => {
    nextMatch();
    const state = getSearchState();
    setSearchBar((prev) => prev ? { ...prev, currentIndex: state.currentIndex, matchCount: state.matches.length } : null);
  }, [nextMatch, getSearchState]);

  const handlePrevMatch = useCallback(() => {
    prevMatch();
    const state = getSearchState();
    setSearchBar((prev) => prev ? { ...prev, currentIndex: state.currentIndex, matchCount: state.matches.length } : null);
  }, [prevMatch, getSearchState]);

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header with inline toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-edge">
        <Pencil className="w-4 h-4 text-ink-faint mr-1" />
        <h2 className="text-sm font-medium text-ink-secondary mr-2">Scratchpad</h2>
        {showToolbar && <TiptapToolbar editor={editor} inline />}
        <div className="ml-auto">
          <button
            onClick={toggleToolbar}
            className={`p-1.5 rounded transition-colors ${
              showToolbar
                ? 'text-accent bg-accent/10'
                : 'text-ink-faint hover:text-ink hover:bg-hover'
            }`}
            title={showToolbar ? 'Hide formatting toolbar' : 'Show formatting toolbar'}
          >
            <Type className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tiptap editor */}
      <div className="tiptap-editor flex-1 min-h-0 overflow-auto relative">
        {searchBar && (
          <SearchHighlightBar
            query={searchBar.query}
            matchCount={searchBar.matchCount}
            currentIndex={searchBar.currentIndex}
            onNext={handleNextMatch}
            onPrev={handlePrevMatch}
            onClose={handleDismissSearch}
          />
        )}
        <EditorContent editor={editor} />
      </div>

      {/* Table context menu */}
      <TableMenu editor={editor} />

      {/* Footer */}
      <div className="px-4 py-1 border-t border-edge text-xs text-ink-dim">
        {charCount} characters
      </div>
    </div>
  );
}
