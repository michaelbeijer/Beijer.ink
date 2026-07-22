export type SearchResultType = 'note' | 'scratchpad' | 'notebook' | 'board' | 'column' | 'card';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  headline: string;
  context: string | null;
  notebookId: string | null;
  boardId: string | null;
  cardId: string | null;
  rank: number;
  updatedAt: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}
