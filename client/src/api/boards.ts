import api from './client';
import type { Board, BoardSummary, BoardType, BoardSettings, CalendarCard, Column, Card, Label, ChecklistItem } from '../types/board';

// ── Boards ──

export async function getBoards(): Promise<BoardSummary[]> {
  const { data } = await api.get<BoardSummary[]>('/boards');
  return data;
}

/** All dated cards across every board, for the unified calendar (optional range). */
export async function getCalendarCards(from?: string, to?: string): Promise<CalendarCard[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  const { data } = await api.get<CalendarCard[]>(`/boards/calendar${qs ? `?${qs}` : ''}`);
  return data;
}

export async function getBoard(id: string): Promise<Board> {
  const { data } = await api.get<Board>(`/boards/${id}`);
  return data;
}

export async function createBoard(
  body: { name?: string; type?: BoardType; settings?: BoardSettings } = {}
): Promise<Board> {
  const { data } = await api.post<Board>('/boards', body);
  return data;
}

export async function updateBoard(
  id: string,
  body: Partial<{
    name: string;
    icon: string;
    type: BoardType;
    isFavorite: boolean;
    sortOrder: number;
    labels: Label[];
    settings: BoardSettings;
  }>
): Promise<BoardSummary> {
  const { data } = await api.patch<BoardSummary>(`/boards/${id}`, body);
  return data;
}

export async function deleteBoard(id: string): Promise<void> {
  await api.delete(`/boards/${id}`);
}

/** Two-way sync this board with its linked Google Tasks list; returns the reconciled board. */
export async function syncGoogleTasks(id: string): Promise<Board> {
  const { data } = await api.post<Board>(`/boards/${id}/sync-google-tasks`);
  return data;
}

// ── Columns ──

export async function createColumn(boardId: string, name?: string): Promise<Column> {
  const { data } = await api.post<Column>(`/boards/${boardId}/columns`, { name });
  return data;
}

export async function updateColumn(columnId: string, body: { name?: string }): Promise<Column> {
  const { data } = await api.patch<Column>(`/boards/columns/${columnId}`, body);
  return data;
}

export async function deleteColumn(columnId: string): Promise<void> {
  await api.delete(`/boards/columns/${columnId}`);
}

export async function reorderColumns(boardId: string, columnIds: string[]): Promise<Board> {
  const { data } = await api.patch<Board>(`/boards/${boardId}/columns/reorder`, { columnIds });
  return data;
}

// ── Cards ──

export async function createCard(columnId: string, title?: string): Promise<Card> {
  const { data } = await api.post<Card>(`/boards/columns/${columnId}/cards`, { title });
  return data;
}

export async function updateCard(
  cardId: string,
  body: Partial<{
    title: string;
    description: string;
    dueDate: string | null;
    dueDone: boolean;
    labelIds: string[];
    checklist: ChecklistItem[];
    noteId: string | null;
  }>
): Promise<Card> {
  const { data } = await api.patch<Card>(`/boards/cards/${cardId}`, body);
  return data;
}

export async function deleteCard(cardId: string): Promise<void> {
  await api.delete(`/boards/cards/${cardId}`);
}

export async function moveCard(cardId: string, toColumnId: string, toIndex: number): Promise<Card> {
  const { data } = await api.patch<Card>(`/boards/cards/${cardId}/move`, { toColumnId, toIndex });
  return data;
}
