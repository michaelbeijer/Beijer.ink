import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Pin, PinOff, Maximize2, Minimize2, Type, ListTree, EllipsisVertical } from 'lucide-react';
import { EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';

import { getNoteById, updateNote, deleteNote } from '../../api/notes';
import type { NoteSummary } from '../../types/note';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useTiptap } from '../../hooks/useTiptap';
import { TiptapToolbar } from './TiptapToolbar';
import { SearchHighlightBar } from './SearchHighlightBar';
import { BlockEditor } from './BlockEditor';
import { TableOfContents } from './TableOfContents';
import { TableMenu } from './TableMenu';
import { splitBlocks } from '../../utils/blockParser';

const TOOLBAR_KEY = 'beijer-ink-toolbar';
const TOC_KEY = 'beijer-ink-toc';
const BLOCK_MODE_THRESHOLD = 50_000;

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
    const stored = localStorage.getItem(TOOLBAR_KEY);
    return stored === null ? true : stored === 'true';
  });
  const [showToc, setShowToc] = useState(() => {
    const stored = localStorage.getItem(TOC_KEY);
    return stored === null ? false : stored === 'true';
  });
  const [searchBar, setSearchBar] = useState<{ query: string; matchCount: number; currentIndex: number } | null>(null);
  const pendingSearchRef = useRef<string | null>(null);
  const [blockEditor, setBlockEditor] = useState<Editor | null>(null);
  const activateBlockRef = useRef<((index: number) => void) | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

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

  const isLargeNote = (note?.content?.length ?? 0) >= BLOCK_MODE_THRESHOLD;

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

    if (isLargeNote) {
      // For block mode: just set the search bar — BlockEditor handles highlighting
      setSearchBar({ query, matchCount: 0, currentIndex: -1 });
      return;
    }

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

  // Load note content into Tiptap (deferred so UI chrome renders first)
  // Skip for large notes — BlockEditor handles its own content loading
  useEffect(() => {
    if (note && editor && !isLargeNote) {
      isLoadingRef.current = true;
      // Yield to browser so toolbar/chrome paints before heavy content parsing
      const id = requestAnimationFrame(() => {
        setContent(note.content || '');
        setCharCount((note.content || '').length);
        isLoadingRef.current = false;
        applyPendingSearch();
      });
      return () => cancelAnimationFrame(id);
    }
    // For large notes, just set char count and apply pending search
    if (note && isLargeNote) {
      setCharCount((note.content || '').length);
      applyPendingSearch();
    }
  }, [note, editor, setContent, isLargeNote]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const toggleToc = useCallback(() => {
    setShowToc((prev) => {
      const next = !prev;
      localStorage.setItem(TOC_KEY, String(next));
      return next;
    });
  }, []);

  // Parse blocks for TOC in block mode
  const tocBlocks = useMemo(() => {
    if (!isLargeNote || !note?.content) return undefined;
    return splitBlocks(note.content);
  }, [isLargeNote, note?.content]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTocBlockClick = useCallback((blockIndex: number) => {
    activateBlockRef.current?.(blockIndex);
  }, []);

  const handleDismissSearch = useCallback(() => {
    clearSearch();
    blockEditor?.commands.clearSearchQuery();
    setSearchBar(null);
    onClearSearch?.();
  }, [clearSearch, blockEditor, onClearSearch]);

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

  // Close action menu on click outside
  useEffect(() => {
    if (!showActionMenu) return;
    function handleClick(e: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActionMenu]);

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Action bar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-edge">
        {/* Formatting toolbar */}
        {showToolbar && <TiptapToolbar editor={isLargeNote ? blockEditor : editor} inline />}

        <div className="ml-auto shrink-0" />

        {/* Desktop: all action buttons inline */}
        <div className="hidden lg:flex items-center gap-0.5">
          <button
            onClick={toggleToc}
            className={`p-1.5 rounded transition-colors ${
              showToc
                ? 'text-accent bg-accent/10'
                : 'text-ink-faint hover:text-ink hover:bg-hover'
            }`}
            title={showToc ? 'Hide table of contents' : 'Show table of contents'}
          >
            <ListTree className="w-4 h-4" />
          </button>
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

        {/* Mobile: overflow menu */}
        <div ref={actionMenuRef} className="relative lg:hidden shrink-0">
          <button
            onClick={() => setShowActionMenu((p) => !p)}
            className="p-1.5 text-ink-faint hover:text-ink hover:bg-hover rounded transition-colors"
            title="More actions"
          >
            <EllipsisVertical className="w-4 h-4" />
          </button>
          {showActionMenu && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-card border border-edge rounded-lg shadow-lg py-1">
              <button
                onClick={() => { toggleToc(); setShowActionMenu(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-secondary hover:bg-hover"
              >
                <ListTree className="w-4 h-4" />
                {showToc ? 'Hide contents' : 'Table of contents'}
              </button>
              <button
                onClick={() => { toggleToolbar(); setShowActionMenu(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-secondary hover:bg-hover"
              >
                <Type className="w-4 h-4" />
                {showToolbar ? 'Hide toolbar' : 'Show toolbar'}
              </button>
              <button
                onClick={() => {
                  if (noteId && note) {
                    pinMutation.mutate({ id: noteId, isPinned: !note.isPinned });
                  }
                  setShowActionMenu(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-secondary hover:bg-hover"
              >
                {note?.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                {note?.isPinned ? 'Unpin' : 'Pin'}
              </button>
              <div className="h-px bg-edge my-1" />
              <button
                onClick={() => {
                  if (noteId && confirm('Delete this note?')) {
                    deleteMutation.mutate(noteId);
                  }
                  setShowActionMenu(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-hover"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

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

        {/* Table of contents */}
        {showToc && (
          <TableOfContents
            editor={isLargeNote ? null : editor}
            blocks={tocBlocks}
            onBlockClick={handleTocBlockClick}
          />
        )}

        {isLargeNote ? (
          <BlockEditor
            content={note?.content || ''}
            onChange={handleChange}
            onEditorReady={setBlockEditor}
            onActivateBlockRef={(ref) => { activateBlockRef.current = ref; }}
            placeholder="Start writing..."
            searchQuery={searchBar?.query}
            onSearchResult={(matchCount) => {
              setSearchBar((prev) =>
                prev ? { ...prev, matchCount, currentIndex: matchCount > 0 ? 0 : -1 } : null
              );
            }}
          />
        ) : (
          <div className="tiptap-editor w-full min-h-0 overflow-auto">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>

      {/* Table context menu (right-click inside a table) */}
      <TableMenu editor={isLargeNote ? blockEditor : editor} />

      {/* Status bar */}
      <div className="px-4 py-1 border-t border-edge text-xs text-ink-dim">
        {charCount} characters
      </div>
    </div>
  );
}
