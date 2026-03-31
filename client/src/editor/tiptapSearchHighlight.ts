import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface SearchHighlightState {
  query: string;
  matches: { from: number; to: number }[];
  currentIndex: number;
}

const emptyState: SearchHighlightState = { query: '', matches: [], currentIndex: -1 };

const searchPluginKey = new PluginKey<SearchHighlightState>('searchHighlight');

function findMatches(doc: ProseMirrorNode, query: string) {
  const matches: { from: number; to: number }[] = [];
  if (!query) return matches;

  const lowerQuery = query.toLowerCase();
  const text = doc.textBetween(0, doc.content.size, '\n', '\0');
  const lowerText = text.toLowerCase();

  let pos = 0;
  while (pos < lowerText.length) {
    const idx = lowerText.indexOf(lowerQuery, pos);
    if (idx === -1) break;
    // +1 because ProseMirror positions are 1-indexed (doc starts at 0, content at 1)
    matches.push({ from: idx + 1, to: idx + 1 + query.length });
    pos = idx + 1;
  }

  return matches;
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
    return { ...emptyState };
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
      new Plugin<SearchHighlightState>({
        key: searchPluginKey,

        state: {
          init() {
            return { ...emptyState };
          },

          apply(tr, state) {
            const meta = tr.getMeta(searchPluginKey);

            if (meta?.type === 'setQuery') {
              const query = meta.query as string;
              if (!query) return { ...emptyState };
              const matches = findMatches(tr.doc, query);
              const newState = { query, matches, currentIndex: matches.length > 0 ? 0 : -1 };
              extensionThis.storage.query = newState.query;
              extensionThis.storage.matches = newState.matches;
              extensionThis.storage.currentIndex = newState.currentIndex;
              return newState;
            }

            if (meta?.type === 'clear') {
              extensionThis.storage.query = '';
              extensionThis.storage.matches = [];
              extensionThis.storage.currentIndex = -1;
              return { ...emptyState };
            }

            if (meta?.type === 'setIndex') {
              const newState = { ...state, currentIndex: meta.index as number };
              extensionThis.storage.currentIndex = newState.currentIndex;
              return newState;
            }

            // If the document changed, clear search
            if (tr.docChanged && state.query) {
              extensionThis.storage.query = '';
              extensionThis.storage.matches = [];
              extensionThis.storage.currentIndex = -1;
              return { ...emptyState };
            }

            return state;
          },
        },

        props: {
          decorations(editorState) {
            const state = searchPluginKey.getState(editorState);
            if (!state || state.matches.length === 0) return DecorationSet.empty;

            const decorations = state.matches.map((m, i) =>
              Decoration.inline(m.from, m.to, {
                class: i === state.currentIndex ? 'tiptap-search-match-active' : 'tiptap-search-match',
              })
            );

            return DecorationSet.create(editorState.doc, decorations);
          },
        },
      }),
    ];
  },
});

export function getSearchPluginKey() {
  return searchPluginKey;
}
