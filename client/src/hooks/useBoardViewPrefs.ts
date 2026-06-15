import { useState, useCallback } from 'react';

export type BoardViewType = 'kanban' | 'calendar' | 'table' | 'list';
export type KanbanGroupBy = 'list' | 'week';
export type CalendarMode = 'month' | 'week';

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
  const calKey = `bink:board:${boardId}:calendarMode`;

  const [view, setViewState] = useState<BoardViewType>(
    () => read(viewKey, 'kanban') as BoardViewType
  );
  const [groupBy, setGroupByState] = useState<KanbanGroupBy>(
    () => read(groupKey, 'list') as KanbanGroupBy
  );
  const [calendarMode, setCalendarModeState] = useState<CalendarMode>(
    () => read(calKey, 'month') as CalendarMode
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

  const setCalendarMode = useCallback(
    (m: CalendarMode) => {
      setCalendarModeState(m);
      write(calKey, m);
    },
    [calKey]
  );

  return { view, setView, groupBy, setGroupBy, calendarMode, setCalendarMode };
}
