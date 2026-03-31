import { useRef, useCallback, useEffect } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Underline } from '@tiptap/extension-underline';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { SearchHighlight, getSearchPluginKey } from '../editor/tiptapSearchHighlight';
import type { SearchHighlightState } from '../editor/tiptapSearchHighlight';

const DEBOUNCE_MS = 300;

interface UseTiptapOptions {
  onChange: (html: string) => void;
  placeholder?: string;
}

export function useTiptap({ onChange, placeholder }: UseTiptapOptions) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const suppressRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({ openOnClick: false, autolink: false }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      SearchHighlight,
    ],
    // Prevent React re-renders on every transaction (cursor move, selection, etc.)
    // This is critical for large documents — without it, React re-renders the
    // entire component tree on every keystroke/selection change.
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor: ed }) => {
      if (suppressRef.current) return;
      // Debounce the expensive getHTML() serialization
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChangeRef.current(ed.getHTML());
      }, DEBOUNCE_MS);
    },
  });

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const setContent = useCallback(
    (html: string) => {
      if (!editor) return;
      // Cancel any pending debounced save from the previous note
      if (debounceRef.current) clearTimeout(debounceRef.current);
      suppressRef.current = true;
      editor.commands.setContent(html);
      suppressRef.current = false;
    },
    [editor]
  );

  const focus = useCallback(() => {
    editor?.commands.focus();
  }, [editor]);

  const getTextLength = useCallback(() => {
    return editor?.getText().length ?? 0;
  }, [editor]);

  const getText = useCallback(() => {
    return editor?.getText() ?? '';
  }, [editor]);

  // ── Search highlighting ──

  const setSearch = useCallback(
    (query: string) => {
      if (!editor) return;
      editor.commands.setSearchQuery(query);
    },
    [editor]
  );

  const clearSearch = useCallback(() => {
    if (!editor) return;
    editor.commands.clearSearchQuery();
  }, [editor]);

  const getSearchState = useCallback((): SearchHighlightState => {
    if (!editor) return { query: '', matches: [], currentIndex: -1 };
    const state = getSearchPluginKey().getState(editor.state);
    return state ?? { query: '', matches: [], currentIndex: -1 };
  }, [editor]);

  const goToMatch = useCallback(
    (index: number) => {
      if (!editor) return;
      const state = getSearchState();
      if (index < 0 || index >= state.matches.length) return;
      editor.commands.setCurrentMatch(index);
      // Scroll the match into view
      const match = state.matches[index];
      editor.commands.focus(match.from);
    },
    [editor, getSearchState]
  );

  const nextMatch = useCallback(() => {
    const state = getSearchState();
    if (state.matches.length === 0) return;
    const next = (state.currentIndex + 1) % state.matches.length;
    goToMatch(next);
  }, [getSearchState, goToMatch]);

  const prevMatch = useCallback(() => {
    const state = getSearchState();
    if (state.matches.length === 0) return;
    const prev = (state.currentIndex - 1 + state.matches.length) % state.matches.length;
    goToMatch(prev);
  }, [getSearchState, goToMatch]);

  return {
    editor,
    setContent,
    focus,
    getTextLength,
    getText,
    setSearch,
    clearSearch,
    getSearchState,
    goToMatch,
    nextMatch,
    prevMatch,
  };
}
