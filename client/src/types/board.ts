export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** Lightweight board, used in the sidebar list. */
export interface BoardSummary {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  columnId: string;
  title: string;
  description: string;
  sortOrder: number;
  dueDate: string | null;
  dueDone: boolean;
  labelIds: string[];
  checklist: ChecklistItem[];
  noteId: string | null;
  note?: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  sortOrder: number;
  cards: Card[];
  createdAt: string;
  updatedAt: string;
}

/** Full board with columns and cards (the board detail view). */
export interface Board {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isFavorite: boolean;
  labels: Label[];
  columns: Column[];
  createdAt: string;
  updatedAt: string;
}

/** Trello-style label palette used when creating boards / rendering chips. */
export const LABEL_COLORS: Record<string, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#a855f7',
  blue: '#3b82f6',
  sky: '#0ea5e9',
  pink: '#ec4899',
  lime: '#84cc16',
  slate: '#64748b',
};
