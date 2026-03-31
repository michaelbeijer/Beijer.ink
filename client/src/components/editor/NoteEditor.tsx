import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Pin, PinOff, Maximize2, Minimize2, Type } from 'lucide-react';
import { EditorContent } from '@tiptap/react';

import { getNoteById, updateNote, deleteNote } from '../../api/notes';
import type { NoteSummary } from '../../types/note';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useTiptap } from '../../hooks/useTiptap';
import { TiptapToolbar } from './TiptapToolbar';
import { SearchHighlightBar } from './SearchHighlightBar';

const TOOLBAR_KEY = 'beijer-ink-toolbar';

interface NoteEditorProps {
  noteId: string;
  onNoteDeleted?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  searchQuery?: string | null;
  onClearSearch?: () => void;
}

export function NoteEditor({ noteId, onNoteDeleted, isFullscreen, onToggleFullscreen, searchQuery, onClearSearch }: NoteEditorProps) {
  const queryClient = useQueryClient();
  const { save } = useAutoSave(noteId);
  const isLoadingRef = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;
  const [charCount, setCharCount] = useState(0);
  const [showToolbar, setShowToolbar] = useState(() => {
    return localStorage.getItem(TOOLBAR_KEY) === 'true';
  });
  const [searchBar, setSearchBar] = useState<{ query: string; matchCount: number; currentIndex: number } | null>(null);
  const pendingSearchRef = useRef<string | null>(null);

  const handleChange = useCallback(
    (html: string) => {
      // User started typing — clear search highlights
      setSearchBar(null);
      if (!isLoadingRef.current) {
        // Extract title from HTML cheaply (no full doc traversal)
        const titleMatch = html.match(/<(?:h[1-6]|p)[^>]*>(.*?)<\/(?:h[1-6]|p)>/);
        const firstLine = titleMatch
          ? titleMatch[1].replace(/<[^>]+>/g, '').trim() || 'Untitled'
          : 'Untitled';
        setCharCount(html.length);
        queryClient.setQueriesData<NoteSummary[]>(
          { queryKey: ['notes'] },
          (old) =>
            old?.map((n) =>
              n.id === noteId ? { ...n, title: firstLine, content: html } : n
            )
        );
        saveRef.current(html);
      }
    },
    [noteId, queryClient]
  );

  const { editor, setContent, focus, setSearch, clearSearch, getSearchState, goToMatch, nextMatch, prevMatch } = useTiptap({
    onChange: handleChange,
    placeholder: 'Start writing...',
  });

  // Keep a ref to editor for use inside handleChange
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const { data: note } = useQuery({
    queryKey: ['note', noteId],
    queryFn: () => getNoteById(noteId),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      onNoteDeleted?.();
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) =>
      updateNote(id, { isPinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['note', noteId] });
    },
  });

  // Stash incoming search query so we can apply it after content loads
  useEffect(() => {
    if (searchQuery) {
      pendingSearchRef.current = searchQuery;
      // If the note is already loaded, apply search immediately
      if (note) {
        applyPendingSearch();
      }
    }
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Load note content into Tiptap
  useEffect(() => {
    if (note && editor) {
      isLoadingRef.current = true;
      setContent(note.content || '');
      setCharCount((note.content || '').length);
      isLoadingRef.current = false;

      // Apply pending search after document is set
      applyPendingSearch();
    }
  }, [note, editor, setContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus on load (skip on touch devices to avoid keyboard popup)
  useEffect(() => {
    if (note && editor && !('ontouchstart' in window)) focus();
  }, [note, editor, focus]);

  // Escape exits fullscreen
  useEffect(() => {
    if (!isFullscreen || !onToggleFullscreen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onToggleFullscreen!();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isFullscreen, onToggleFullscreen]);

  // Persist toolbar preference
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
      {/* Action bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-edge">
        <div className="mr-auto" />

        {/* Right-side actions */}
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
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="p-1.5 text-ink-faint hover:text-ink hover:bg-hover rounded transition-colors"
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}
        <button
          onClick={() => {
            if (noteId && note) {
              pinMutation.mutate({ id: noteId, isPinned: !note.isPinned });
            }
          }}
          className="p-1.5 text-ink-faint hover:text-ink hover:bg-hover rounded transition-colors"
          title={note?.isPinned ? 'Unpin' : 'Pin'}
        >
          {note?.isPinned ? (
            <PinOff className="w-4 h-4" />
          ) : (
            <Pin className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={() => {
            if (noteId && confirm('Delete this note?')) {
              deleteMutation.mutate(noteId);
            }
          }}
          className="p-1.5 text-ink-faint hover:text-danger hover:bg-hover rounded transition-colors"
          title="Delete note"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Formatting toolbar */}
      {showToolbar && <TiptapToolbar editor={editor} />}

      {/* Editor area */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Search highlight bar */}
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

        {/* Tiptap editor */}
        <div className="tiptap-editor w-full min-h-0 overflow-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Status bar */}
      <div className="px-4 py-1 border-t border-edge text-xs text-ink-dim">
        {charCount} characters
      </div>
    </div>
  );
}
