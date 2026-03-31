import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface SearchHighlightState {
  query: string;
  matches: { from: number; to: number }[];
  currentIndex: number;
}

interface PluginState extends SearchHighlightState {
  decorationSet: DecorationSet;
}

const emptyState: PluginState = {
  query: '',
  matches: [],
  currentIndex: -1,
  decorationSet: DecorationSet.empty,
};

const searchPluginKey = new PluginKey<PluginState>('searchHighlight');

function findMatches(doc: ProseMirrorNode, query: string) {
  const matches: { from: number; to: number }[] = [];
  if (!query) return matches;

  const lowerQuery = query.toLowerCase();

  // Walk all text nodes to get correct ProseMirror positions.
  // textBetween() strips node boundaries so char indices don't map to PM positions.
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    const text = node.text.toLowerCase();
    let idx = 0;
    while (idx < text.length) {
      const found = text.indexOf(lowerQuery, idx);
      if (found === -1) break;
      matches.push({ from: pos + found, to: pos + found + query.length });
      idx = found + 1;
    }
  });

  return matches;
}

function buildDecorations(doc: ProseMirrorNode, matches: { from: number; to: number }[], currentIndex: number): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty;
  const decorations = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === currentIndex ? 'tiptap-search-match-active' : 'tiptap-search-match',
    })
  );
  return DecorationSet.create(doc, decorations);
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearchQuery: (query: string) => ReturnType;
      clearSearchQuery: () => ReturnType;
      setCurrentMatch: (index: number) => ReturnType;
    };
  }
}

export const SearchHighlight = Extension.create({
  name: 'searchHighlight',

  addStorage() {
    return { query: '', matches: [] as { from: number; to: number }[], currentIndex: -1 };
  },

  addCommands() {
    return {
      setSearchQuery: (query: string) => ({ tr, dispatch }) => {
        if (dispatch) {
          dispatch(tr.setMeta(searchPluginKey, { type: 'setQuery', query }));
        }
        return true;
      },
      clearSearchQuery: () => ({ tr, dispatch }) => {
        if (dispatch) {
          dispatch(tr.setMeta(searchPluginKey, { type: 'clear' }));
        }
        return true;
      },
      setCurrentMatch: (index: number) => ({ tr, dispatch }) => {
        if (dispatch) {
          dispatch(tr.setMeta(searchPluginKey, { type: 'setIndex', index }));
        }
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      new Plugin<PluginState>({
        key: searchPluginKey,

        state: {
          init() {
            return { ...emptyState };
          },

          apply(tr, prev) {
            const meta = tr.getMeta(searchPluginKey);

            if (meta?.type === 'setQuery') {
              const query = meta.query as string;
              if (!query) {
                extensionThis.storage.query = '';
                extensionThis.storage.matches = [];
                extensionThis.storage.currentIndex = -1;
                return { ...emptyState };
              }
              const matches = findMatches(tr.doc, query);
              const currentIndex = matches.length > 0 ? 0 : -1;
              extensionThis.storage.query = query;
              extensionThis.storage.matches = matches;
              extensionThis.storage.currentIndex = currentIndex;
              return { query, matches, currentIndex, decorationSet: buildDecorations(tr.doc, matches, currentIndex) };
            }

            if (meta?.type === 'clear') {
              extensionThis.storage.query = '';
              extensionThis.storage.matches = [];
              extensionThis.storage.currentIndex = -1;
              return { ...emptyState };
            }

            if (meta?.type === 'setIndex') {
              const currentIndex = meta.index as number;
              extensionThis.storage.currentIndex = currentIndex;
              // Rebuild decorations only for the index change (different active class)
              return {
                ...prev,
                currentIndex,
                decorationSet: buildDecorations(tr.doc, prev.matches, currentIndex),
              };
            }

            // If the document changed, clear search
            if (tr.docChanged && prev.query) {
              extensionThis.storage.query = '';
              extensionThis.storage.matches = [];
              extensionThis.storage.currentIndex = -1;
              return { ...emptyState };
            }

            // No change — return the cached state as-is (no DecorationSet rebuild)
            return prev;
          },
        },

        props: {
          decorations(editorState) {
            return searchPluginKey.getState(editorState)?.decorationSet ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export function getSearchPluginKey() {
  return searchPluginKey;
}
