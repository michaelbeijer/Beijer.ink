// beijerterm.com article metadata carried on a note. headword + aliases are the
// search terms that surface the article; lang is ISO 639-1; domain is a subject tag.
export interface NoteMetadata {
  headword?: string;
  aliases?: string[];
  lang?: string;
  domain?: string;
}

export interface Note {
  id: string;
  title: string;
  titleManual: boolean;
  content: string;
  subtitle: string | null;
  slug: string | null;
  metadata: NoteMetadata | null;
  notebookId: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  notebook?: { id: string; name: string; publishTarget?: boolean; publishBeijerterm?: boolean } | null;
}

export interface NoteSummary {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isFavorite: boolean;
  sortOrder: number;
  updatedAt: string;
  createdAt: string;
}
