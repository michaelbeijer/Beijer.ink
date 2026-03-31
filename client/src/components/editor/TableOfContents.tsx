import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import type { Block } from '../../utils/blockParser';

interface Heading {
  level: number;
  text: string;
  /** For normal mode: ProseMirror position of the heading node */
  pos?: number;
  /** For block mode: index into the blocks array */
  blockIndex?: number;
}

interface TableOfContentsProps {
  /** Normal mode editor instance */
  editor: Editor | null;
  /** Block mode: parsed blocks */
  blocks?: Block[];
  /** Block mode: version counter to trigger re-computation */
  blocksVersion?: number;
  /** Block mode: callback to activate a block by index */
  onBlockClick?: (blockIndex: number) => void;
}

/** Strip HTML tags from a string to get plain text */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

export function TableOfContents({ editor, blocks, blocksVersion, onBlockClick }: TableOfContentsProps) {
  const [editorVersion, setEditorVersion] = useState(0);

  // Listen to editor updates to rebuild headings in normal mode
  useEffect(() => {
    if (!editor) return;
    const handler = () => setEditorVersion((v) => v + 1);
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor]);

  const headings = useMemo(() => {
    // Block mode: extract headings from block tags
    if (blocks && blocks.length > 0) {
      const result: Heading[] = [];
      for (let i = 0; i < blocks.length; i++) {
        const tag = blocks[i].tag;
        if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
          const text = stripTags(blocks[i].html);
          if (text) {
            result.push({ level: parseInt(tag[1]), text, blockIndex: i });
          }
        }
      }
      return result;
    }

    // Normal mode: walk the ProseMirror document
    if (editor) {
      const result: Heading[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const text = node.textContent.trim();
          if (text) {
            result.push({ level: node.attrs.level as number, text, pos });
          }
        }
      });
      return result;
    }

    return [];
  }, [editor, blocks, blocksVersion, editorVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback(
    (heading: Heading) => {
      // Block mode navigation
      if (heading.blockIndex !== undefined && onBlockClick) {
        onBlockClick(heading.blockIndex);
        return;
      }

      // Normal mode navigation
      if (editor && heading.pos !== undefined) {
        // Focus the heading position and scroll into view
        editor.commands.focus(heading.pos + 1);
        // Find the DOM node and scroll it into view
        const { node } = editor.view.domAtPos(heading.pos + 1);
        const el = node instanceof HTMLElement ? node : node.parentElement;
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [editor, onBlockClick]
  );

  if (headings.length === 0) return null;

  return (
    <div className="toc-panel">
      <div className="toc-header">Contents</div>
      <nav>
        {headings.map((h, i) => (
          <button
            key={i}
            onClick={() => handleClick(h)}
            className={`toc-item toc-level-${h.level}`}
            title={h.text}
          >
            {h.text}
          </button>
        ))}
      </nav>
    </div>
  );
}
