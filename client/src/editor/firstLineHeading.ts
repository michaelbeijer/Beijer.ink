import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// When enabled (per-note, via editor.storage.firstLineHeading.enabled), forces the
// document's first block to be a level-1 heading — so the first line a writer types
// is automatically the title. Non-destructive: a leading paragraph (or a heading of
// the wrong level) is converted in place, preserving its text. Other block types
// (lists, blockquotes, etc.) at the top are left alone.
export const FirstLineHeading = Extension.create({
  name: 'firstLineHeading',

  addStorage() {
    return { enabled: false };
  },

  addProseMirrorPlugins() {
    const extension = this;
    return [
      new Plugin({
        key: new PluginKey('firstLineHeading'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!extension.storage.enabled) return null;
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const first = newState.doc.firstChild;
          if (!first) return null;

          const { heading, paragraph } = newState.schema.nodes;
          if (!heading) return null;

          const isParagraph = paragraph && first.type === paragraph;
          const isWrongLevelHeading = first.type === heading && first.attrs.level !== 1;
          if (!isParagraph && !isWrongLevelHeading) return null;

          const tr = newState.tr.setNodeMarkup(0, heading, { level: 1 });
          tr.setMeta('addToHistory', false);
          return tr;
        },
      }),
    ];
  },
});
