import { useState, useCallback } from 'react';

export type BoardViewType = 'kanban' | 'calendar' | 'table' | 'list';
export type KanbanGroupBy = 'list' | 'week';

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private-mode errors */
  }
}

/**
 * Per-board UI preferences (which view is shown, and how the kanban is grouped).
 * Pure UI state — persisted in localStorage, never on the server.
 */
export function useBoardViewPrefs(boardId: string) {
  const viewKey = `bink:board:${boardId}:view`;
  const groupKey = `bink:board:${boardId}:groupBy`;

  const [view, setViewState] = useState<BoardViewType>(
    () => read(viewKey, 'kanban') as BoardViewType
  );
  const [groupBy, setGroupByState] = useState<KanbanGroupBy>(
    () => read(groupKey, 'list') as KanbanGroupBy
  );

  const setView = useCallback(
    (v: BoardViewType) => {
      setViewState(v);
      write(viewKey, v);
    },
    [viewKey]
  );

  const setGroupBy = useCallback(
    (g: KanbanGroupBy) => {
      setGroupByState(g);
      write(groupKey, g);
    },
    [groupKey]
  );

  return { view, setView, groupBy, setGroupBy };
}
