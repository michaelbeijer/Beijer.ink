import { useState, useCallback } from 'react';
import type { BoardType } from '../types/board';

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

// Per-type starting view: calendar boards open on the week-grouped Kanban,
// everything else on the classic list-grouped Kanban.
function defaultsForType(type?: BoardType): { view: BoardViewType; groupBy: KanbanGroupBy } {
  if (type === 'calendar') return { view: 'kanban', groupBy: 'week' };
  return { view: 'kanban', groupBy: 'list' };
}

/**
 * Per-device UI preferences (which view is shown, how the kanban is grouped,
 * month vs week calendar). Pure "what am I looking at right now" state — kept in
 * localStorage. Defaults are seeded from the board's server-side type so a fresh
 * device opens the board the right way. Board-intrinsic settings (year, overdue)
 * live on the server in board.settings, not here.
 */
export function useBoardViewPrefs(boardId: string, boardType?: BoardType) {
  const viewKey = `bink:board:${boardId}:view`;
  const groupKey = `bink:board:${boardId}:groupBy`;
  const calKey = `bink:board:${boardId}:calendarMode`;
  const typeDefaults = defaultsForType(boardType);

  const [view, setViewState] = useState<BoardViewType>(
    () => read(viewKey, typeDefaults.view) as BoardViewType
  );
  const [groupBy, setGroupByState] = useState<KanbanGroupBy>(
    () => read(groupKey, typeDefaults.groupBy) as KanbanGroupBy
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

  return {
    view, setView,
    groupBy, setGroupBy,
    calendarMode, setCalendarMode,
  };
}
