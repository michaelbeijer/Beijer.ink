import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
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
import type { Editor } from '@tiptap/react';
import { splitBlocks, joinBlocks, type Block } from '../../utils/blockParser';
import { SearchHighlight, getSearchPluginKey } from '../../editor/tiptapSearchHighlight';

const DEBOUNCE_MS = 300;

interface BlockEditorProps {
  content: string;
  onChange: (html: string) => void;
  onEditorReady?: (editor: Editor | null) => void;
  onActivateBlockRef?: (ref: (index: number) => void) => void;
  placeholder?: string;
  searchQuery?: string | null;
  onSearchResult?: (matchCount: number) => void;
}

export function BlockEditor({ content, onChange, onEditorReady, onActivateBlockRef, placeholder, searchQuery, onSearchResult }: BlockEditorProps) {
  const blocksRef = useRef<Block[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeIndexRef = useRef(-1);
  const [blocksVersion, setBlocksVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const idleRef = useRef<number>(0);
  const suppressRef = useRef(false);
  const lastExternalContent = useRef<string>('');
  // Ref for activateBlock so the keyboard extension can call it
  const activateBlockRef = useRef<(index: number) => void>(() => {});

  // Create keyboard navigation extension once (uses refs for mutable state)
  const blockNavExtension = useMemo(
    () =>
      Extension.create({
        name: 'blockNav',
        addKeyboardShortcuts() {
          return {
            ArrowUp: ({ editor: ed }) => {
              const idx = activeIndexRef.current;
              if (idx <= 0) return false;
              const { from } = ed.state.selection;
              if (from <= 1) {
                activateBlockRef.current(idx - 1);
                requestAnimationFrame(() => ed.commands.focus('end'));
                return true;
              }
              return false;
            },
            ArrowDown: ({ editor: ed }) => {
              const idx = activeIndexRef.current;
              if (idx < 0 || idx >= blocksRef.current.length - 1) return false;
              const { to } = ed.state.selection;
              const docEnd = ed.state.doc.content.size;
              if (to >= docEnd - 1) {
                activateBlockRef.current(idx + 1);
                requestAnimationFrame(() => ed.commands.focus('start'));
                return true;
              }
              return false;
            },
          };
        },
      }),
    []
  );

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
      blockNavExtension,
    ],
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor: ed }) => {
      if (suppressRef.current) return;
      const idx = activeIndexRef.current;
      if (idx >= 0 && idx < blocksRef.current.length) {
        blocksRef.current[idx] = {
          html: ed.getHTML(),
          tag: blocksRef.current[idx].tag,
        };
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const joined = joinBlocks(blocksRef.current);
        if ('requestIdleCallback' in window) {
          if (idleRef.current) cancelIdleCallback(idleRef.current);
          idleRef.current = requestIdleCallback(
            () => onChangeRef.current(joined),
            { timeout: 2000 }
          );
        } else {
          onChangeRef.current(joined);
        }
      }, DEBOUNCE_MS);
    },
  });

  // Expose editor to parent (for toolbar)
  useEffect(() => {
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (idleRef.current && 'cancelIdleCallback' in window) cancelIdleCallback(idleRef.current);
    };
  }, []);

  // Parse content into blocks when content prop changes externally
  useEffect(() => {
    if (content === lastExternalContent.current) return;
    lastExternalContent.current = content;
    blocksRef.current = splitBlocks(content);
    activeIndexRef.current = -1;
    setActiveIndex(-1);
    setBlocksVersion((v) => v + 1); // Force re-render so useMemo picks up new blocks
  }, [content]);

  // Auto-activate the first block once blocks are parsed and editor is ready
  useEffect(() => {
    if (editor && blocksRef.current.length > 0 && activeIndexRef.current < 0) {
      activateBlockRef.current(0);
    }
  }, [editor, blocksVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle search query: find the block containing the match, activate it, highlight
  useEffect(() => {
    if (!editor || !searchQuery || blocksRef.current.length === 0) return;
    const lowerQuery = searchQuery.toLowerCase();

    // Find the first block whose text contains the query
    const parser = new DOMParser();
    let targetIndex = -1;
    for (let i = 0; i < blocksRef.current.length; i++) {
      const doc = parser.parseFromString(blocksRef.current[i].html, 'text/html');
      const text = doc.body.textContent?.toLowerCase() ?? '';
      if (text.includes(lowerQuery)) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex < 0) {
      onSearchResult?.(0);
      return;
    }

    // Activate the block containing the match
    activateBlockRef.current(targetIndex);

    // Apply search highlighting after the block content is loaded
    requestAnimationFrame(() => {
      editor.commands.setSearchQuery(searchQuery);
      const state = getSearchPluginKey().getState(editor.state);
      const matchCount = state?.matches.length ?? 0;
      onSearchResult?.(matchCount);
      if (matchCount > 0) {
        editor.commands.setCurrentMatch(0);
        const match = state!.matches[0];
        editor.commands.focus(match.from);
      }
    });
  }, [editor, searchQuery, blocksVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deactivate the current block and serialize its content back
  const deactivateBlock = useCallback(() => {
    if (!editor) return;
    const idx = activeIndexRef.current;
    if (idx >= 0 && idx < blocksRef.current.length) {
      blocksRef.current[idx] = {
        html: editor.getHTML(),
        tag: blocksRef.current[idx].tag,
      };
    }
  }, [editor]);

  // Activate a block: load its HTML into the editor
  const activateBlock = useCallback(
    (index: number) => {
      if (!editor) return;
      if (index < 0 || index >= blocksRef.current.length) return;

      deactivateBlock();

      activeIndexRef.current = index;
      setActiveIndex(index);

      suppressRef.current = true;
      editor.commands.setContent(blocksRef.current[index].html);
      suppressRef.current = false;

      requestAnimationFrame(() => {
        editor.commands.focus();
      });
    },
    [editor, deactivateBlock]
  );

  // Keep the ref in sync for the keyboard extension
  activateBlockRef.current = activateBlock;

  // Expose activateBlock to parent (for TOC navigation)
  useEffect(() => {
    onActivateBlockRef?.(activateBlock);
  }, [activateBlock, onActivateBlockRef]);

  // Compute before/after HTML
  const { beforeHtml, afterHtml } = useMemo(() => {
    const blocks = blocksRef.current;
    if (activeIndex < 0) {
      return { beforeHtml: joinBlocks(blocks), afterHtml: '' };
    }
    const before = blocks.slice(0, activeIndex).map((b) => b.html).join('');
    const after = blocks.slice(activeIndex + 1).map((b) => b.html).join('');
    return { beforeHtml: before, afterHtml: after };
  }, [activeIndex, blocksVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click handler to activate blocks
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (editorWrapperRef.current?.contains(e.target as Node)) return;

      const container = containerRef.current;
      if (!container) return;

      const beforeDiv = container.querySelector('[data-block-section="before"]');
      const afterDiv = container.querySelector('[data-block-section="after"]');

      let clickedBlockIndex = -1;

      if (beforeDiv?.contains(e.target as Node)) {
        const children = beforeDiv.children;
        for (let i = 0; i < children.length; i++) {
          if (children[i].contains(e.target as Node)) {
            clickedBlockIndex = i;
            break;
          }
        }
      } else if (afterDiv?.contains(e.target as Node)) {
        const children = afterDiv.children;
        for (let i = 0; i < children.length; i++) {
          if (children[i].contains(e.target as Node)) {
            clickedBlockIndex = (activeIndex >= 0 ? activeIndex + 1 : blocksRef.current.length) + i;
            break;
          }
        }
      }

      if (clickedBlockIndex >= 0 && clickedBlockIndex < blocksRef.current.length) {
        activateBlock(clickedBlockIndex);
      }
    },
    [activeIndex, activateBlock]
  );

  return (
    <div
      ref={containerRef}
      className="tiptap-content w-full min-h-0 overflow-auto px-8 py-4 cursor-text"
      onClick={handleClick}
    >
      <div data-block-section="before" dangerouslySetInnerHTML={{ __html: beforeHtml }} />

      {activeIndex >= 0 && (
        <div ref={editorWrapperRef} className="block-editor-active">
          <EditorContent editor={editor} />
        </div>
      )}

      <div data-block-section="after" dangerouslySetInnerHTML={{ __html: afterHtml }} />
    </div>
  );
}
