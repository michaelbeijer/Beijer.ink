import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Type } from 'lucide-react';
import { EditorContent } from '@tiptap/react';
import { getScratchpad, updateScratchpad } from '../../api/scratchpad';
import { useTiptap } from '../../hooks/useTiptap';
import { TiptapToolbar } from '../editor/TiptapToolbar';
import { TableMenu } from '../editor/TableMenu';

const TOOLBAR_KEY = 'beijer-ink-toolbar';

export function Scratchpad() {
  const [charCount, setCharCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSavedRef = useRef<string>('');
  const [showToolbar, setShowToolbar] = useState(() => {
    const stored = localStorage.getItem(TOOLBAR_KEY);
    return stored === null ? true : stored === 'true';
  });

  const handleChange = useCallback((html: string) => {
    setCharCount(html.length);

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

  const { editor, setContent, focus } = useTiptap({
    onChange: handleChange,
    placeholder: 'Jot something down...',
  });

  const editorRef = useRef(editor);
  editorRef.current = editor;

  const { data } = useQuery({
    queryKey: ['scratchpad'],
    queryFn: getScratchpad,
  });

  // Load saved content
  useEffect(() => {
    if (data && editor) {
      setContent(data.content);
      setCharCount((data.content || '').length);
      lastSavedRef.current = data.content;
    }
  }, [data, editor, setContent]);

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

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-edge">
        <Pencil className="w-4 h-4 text-ink-faint" />
        <h2 className="text-sm font-medium text-ink-secondary">Scratchpad</h2>
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

      {/* Formatting toolbar */}
      {showToolbar && <TiptapToolbar editor={editor} />}

      {/* Tiptap editor */}
      <div className="tiptap-editor flex-1 min-h-0 overflow-auto">
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
