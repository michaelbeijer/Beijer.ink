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
  const yearKey = `bink:board:${boardId}:year`;

  const [view, setViewState] = useState<BoardViewType>(
    () => read(viewKey, 'kanban') as BoardViewType
  );
  const [groupBy, setGroupByState] = useState<KanbanGroupBy>(
    () => read(groupKey, 'list') as KanbanGroupBy
  );
  const [calendarMode, setCalendarModeState] = useState<CalendarMode>(
    () => read(calKey, 'month') as CalendarMode
  );
  // A "year board" shows every ISO week of that year as a column; null = off.
  const [year, setYearState] = useState<number | null>(() => {
    const raw = read(yearKey, '');
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  // Overdue rollup on the mobile week view — per board. Defaults OFF for year
  // boards (they're logs of past weeks) and ON otherwise (to-do-style boards).
  const overdueKey = `bink:board:${boardId}:showOverdue`;
  const [showOverdue, setShowOverdueState] = useState<boolean>(() => {
    const raw = read(overdueKey, '');
    if (raw === '1') return true;
    if (raw === '0') return false;
    const yr = parseInt(read(yearKey, ''), 10);
    return !(Number.isFinite(yr) && yr > 0);
  });

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

  const setYear = useCallback(
    (y: number | null) => {
      setYearState(y);
      write(yearKey, y && y > 0 ? String(y) : '');
    },
    [yearKey]
  );

  const setShowOverdue = useCallback(
    (v: boolean) => {
      setShowOverdueState(v);
      write(overdueKey, v ? '1' : '0');
    },
    [overdueKey]
  );

  return {
    view, setView,
    groupBy, setGroupBy,
    calendarMode, setCalendarMode,
    year, setYear,
    showOverdue, setShowOverdue,
  };
}
