import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Link,
  List,
  ListOrdered,
  Quote,
  Minus,
  Strikethrough,
  Table,
  Underline,
  Baseline,
  Eraser,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface TiptapToolbarProps {
  editor: Editor | null;
  inline?: boolean;
}

// Fonts offered in the toolbar. The display fonts (Special Elite, Permanent Marker,
// Caveat) are loaded in index.html here AND on autofingers.com, so styled writing
// renders the same in both places.
const FONTS: { label: string; value: string }[] = [
  { label: 'Default', value: '' },
  { label: 'Sans', value: 'system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: 'ui-monospace, "Courier New", monospace' },
  { label: 'Typewriter', value: '"Special Elite", monospace' },
  { label: 'Marker', value: '"Permanent Marker", cursive' },
  { label: 'Handwriting', value: '"Caveat", cursive' },
];

type ToolbarAction = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
};

const actions: ToolbarAction[] = [
  {
    icon: Bold,
    title: 'Bold',
    action: (e) => e.chain().focus().toggleBold().run(),
    isActive: (e) => e.isActive('bold'),
  },
  {
    icon: Italic,
    title: 'Italic',
    action: (e) => e.chain().focus().toggleItalic().run(),
    isActive: (e) => e.isActive('italic'),
  },
  {
    icon: Underline,
    title: 'Underline',
    action: (e) => e.chain().focus().toggleUnderline().run(),
    isActive: (e) => e.isActive('underline'),
  },
  {
    icon: Strikethrough,
    title: 'Strikethrough',
    action: (e) => e.chain().focus().toggleStrike().run(),
    isActive: (e) => e.isActive('strike'),
  },
  {
    icon: Heading1,
    title: 'Heading 1',
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (e) => e.isActive('heading', { level: 1 }),
  },
  {
    icon: Heading2,
    title: 'Heading 2',
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (e) => e.isActive('heading', { level: 2 }),
  },
  {
    icon: Heading3,
    title: 'Heading 3',
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (e) => e.isActive('heading', { level: 3 }),
  },
  {
    icon: Code,
    title: 'Inline code',
    action: (e) => e.chain().focus().toggleCode().run(),
    isActive: (e) => e.isActive('code'),
  },
  {
    icon: Link,
    title: 'Link',
    action: (e) => {
      if (e.isActive('link')) {
        e.chain().focus().unsetLink().run();
        return;
      }
      const url = window.prompt('Enter URL:');
      if (url) {
        e.chain().focus().setLink({ href: url }).run();
      }
    },
    isActive: (e) => e.isActive('link'),
  },
  {
    icon: List,
    title: 'Bullet list',
    action: (e) => e.chain().focus().toggleBulletList().run(),
    isActive: (e) => e.isActive('bulletList'),
  },
  {
    icon: ListOrdered,
    title: 'Ordered list',
    action: (e) => e.chain().focus().toggleOrderedList().run(),
    isActive: (e) => e.isActive('orderedList'),
  },
  {
    icon: Quote,
    title: 'Quote',
    action: (e) => e.chain().focus().toggleBlockquote().run(),
    isActive: (e) => e.isActive('blockquote'),
  },
  {
    icon: Table,
    title: 'Table',
    action: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    icon: Minus,
    title: 'Horizontal rule',
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
];

export function TiptapToolbar({ editor, inline }: TiptapToolbarProps) {
  if (!editor) return null;

  const buttons = actions.map((action) => (
    <button
      key={action.title}
      onClick={() => action.action(editor)}
      className={`p-1.5 rounded transition-colors ${
        action.isActive?.(editor)
          ? 'text-accent bg-accent/10'
          : 'text-ink-faint hover:text-ink-secondary hover:bg-hover'
      }`}
      title={action.title}
    >
      <action.icon className="w-4 h-4" />
    </button>
  ));

  const currentFont = (editor.getAttributes('textStyle').fontFamily as string) || '';
  const currentColor = (editor.getAttributes('textStyle').color as string) || '#34302a';

  const extras = (
    <>
      <span className="w-px h-5 bg-edge mx-1 shrink-0" aria-hidden="true" />

      <select
        value={currentFont}
        onChange={(e) => {
          const v = e.target.value;
          const chain = editor.chain().focus();
          if (v) chain.setFontFamily(v).run();
          else chain.unsetFontFamily().run();
        }}
        title="Font"
        className="text-xs bg-transparent text-ink-secondary border border-edge rounded px-1 py-1 cursor-pointer hover:bg-hover focus:outline-none focus:border-accent"
      >
        {FONTS.map((f) => (
          <option key={f.label} value={f.value} style={f.value ? { fontFamily: f.value } : undefined}>
            {f.label}
          </option>
        ))}
      </select>

      <label
        title="Text colour"
        className="relative flex items-center p-1.5 rounded hover:bg-hover cursor-pointer"
      >
        <Baseline className="w-4 h-4" style={{ color: currentColor }} />
        <input
          type="color"
          value={currentColor}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Text colour"
        />
      </label>
      <button
        onClick={() => editor.chain().focus().unsetColor().run()}
        title="Clear colour"
        className="p-1.5 rounded text-ink-faint hover:text-ink-secondary hover:bg-hover"
      >
        <Eraser className="w-4 h-4" />
      </button>
    </>
  );

  if (inline) {
    return <>{buttons}{extras}</>;
  }

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-edge bg-panel">
      {buttons}
      {extras}
    </div>
  );
}
