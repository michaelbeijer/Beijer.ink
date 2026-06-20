export interface Note {
  id: string;
  title: string;
  content: string;
  subtitle: string | null;
  slug: string | null;
  notebookId: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  notebook?: { id: string; name: string; publishTarget?: boolean } | null;
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
