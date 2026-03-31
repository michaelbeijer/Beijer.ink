import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Merge,
  Split,
  ToggleRight,
  Rows3,
  Columns3,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface TableMenuProps {
  editor: Editor | null;
}

export function TableMenu({ editor }: TableMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      if (!editor) return;

      // Check if cursor is in a table
      if (!editor.isActive('table')) return;

      // Check if right-click target is inside the editor DOM
      const editorDom = editor.view.dom;
      if (!editorDom.contains(e.target as Node)) return;

      e.preventDefault();
      setPosition({ x: e.clientX, y: e.clientY });
      setOpen(true);
    },
    [editor]
  );

  // Close on click outside or escape
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Attach context menu listener to the editor's parent
  useEffect(() => {
    if (!editor) return;
    const editorEl = editor.view.dom.closest('.tiptap-editor, .tiptap-content, .block-editor-active');
    if (!editorEl) return;

    editorEl.addEventListener('contextmenu', handleContextMenu as EventListener);
    return () => {
      editorEl.removeEventListener('contextmenu', handleContextMenu as EventListener);
    };
  }, [editor, handleContextMenu]);

  if (!open || !editor) return null;

  const run = (fn: (e: Editor) => void) => {
    fn(editor);
    setOpen(false);
  };

  return (
    <div
      ref={menuRef}
      className="table-context-menu"
      style={{ top: position.y, left: position.x }}
    >
      <div className="table-context-menu-group">
        <button className="table-context-menu-item" onClick={() => run((e) => e.chain().focus().addRowBefore().run())}>
          <ArrowUp className="w-3.5 h-3.5" /> Add row above
        </button>
        <button className="table-context-menu-item" onClick={() => run((e) => e.chain().focus().addRowAfter().run())}>
          <ArrowDown className="w-3.5 h-3.5" /> Add row below
        </button>
        <button className="table-context-menu-item table-context-menu-danger" onClick={() => run((e) => e.chain().focus().deleteRow().run())}>
          <Rows3 className="w-3.5 h-3.5" /> Delete row
        </button>
      </div>

      <div className="table-context-menu-separator" />

      <div className="table-context-menu-group">
        <button className="table-context-menu-item" onClick={() => run((e) => e.chain().focus().addColumnBefore().run())}>
          <ArrowLeft className="w-3.5 h-3.5" /> Add column before
        </button>
        <button className="table-context-menu-item" onClick={() => run((e) => e.chain().focus().addColumnAfter().run())}>
          <ArrowRight className="w-3.5 h-3.5" /> Add column after
        </button>
        <button className="table-context-menu-item table-context-menu-danger" onClick={() => run((e) => e.chain().focus().deleteColumn().run())}>
          <Columns3 className="w-3.5 h-3.5" /> Delete column
        </button>
      </div>

      <div className="table-context-menu-separator" />

      <div className="table-context-menu-group">
        <button className="table-context-menu-item" onClick={() => run((e) => e.chain().focus().toggleHeaderRow().run())}>
          <ToggleRight className="w-3.5 h-3.5" /> Toggle header row
        </button>
        <button className="table-context-menu-item" onClick={() => run((e) => e.chain().focus().mergeCells().run())}>
          <Merge className="w-3.5 h-3.5" /> Merge cells
        </button>
        <button className="table-context-menu-item" onClick={() => run((e) => e.chain().focus().splitCell().run())}>
          <Split className="w-3.5 h-3.5" /> Split cell
        </button>
      </div>

      <div className="table-context-menu-separator" />

      <button className="table-context-menu-item table-context-menu-danger" onClick={() => run((e) => e.chain().focus().deleteTable().run())}>
        <Trash2 className="w-3.5 h-3.5" /> Delete table
      </button>
    </div>
  );
}
