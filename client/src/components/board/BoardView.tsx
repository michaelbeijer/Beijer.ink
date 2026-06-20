import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, LayoutGrid, CalendarRange } from 'lucide-react';
import { getBoard, updateBoard } from '../../api/boards';
import type { Board, BoardType, BoardSettings } from '../../types/board';
import { useBoardViewPrefs } from '../../hooks/useBoardViewPrefs';
import { ViewSwitcher } from './ViewSwitcher';
import { BoardOptionsMenu } from './BoardOptionsMenu';
import { KanbanView } from './KanbanView';
import { KanbanWeekView } from './KanbanWeekView';
import { CalendarView } from './CalendarView';
import { TableView } from './TableView';
import { ListView } from './ListView';
import { CardModal } from './CardModal';
import { YearImportDialog } from './YearImportDialog';

interface BoardViewProps {
  boardId: string;
  onOpenNote: (noteId: string) => void;
}

export function BoardView({ boardId, onOpenNote }: BoardViewProps) {
  const { data: board } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => getBoard(boardId),
  });

  if (!board) {
    return (
      <div className="h-full flex items-center justify-center bg-surface">
        <div className="text-ink-muted">Loading board…</div>
      </div>
    );
  }

  // Keyed on board.id so view-pref state (seeded from board.type) resets when
  // switching between boards.
  return <BoardContent key={board.id} board={board} onOpenNote={onOpenNote} />;
}

function BoardContent({ board, onOpenNote }: { board: Board; onOpenNote: (noteId: string) => void }) {
  const queryClient = useQueryClient();
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [boardName, setBoardName] = useState(board.name);
  const [showImport, setShowImport] = useState(false);

  const { view, setView, groupBy, setGroupBy, calendarMode, setCalendarMode } =
    useBoardViewPrefs(board.id, board.type);

  // Board-intrinsic settings come from the server (consistent across devices).
  const year = board.settings?.year ?? null;
  const showOverdue = board.settings?.showOverdue ?? board.type !== 'calendar';

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['board', board.id] });
    queryClient.invalidateQueries({ queryKey: ['boards'] });
  };

  const favoriteMutation = useMutation({
    mutationFn: (isFavorite: boolean) => updateBoard(board.id, { isFavorite }),
    onSuccess: invalidate,
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateBoard(board.id, { name }),
    onSuccess: invalidate,
  });

  const settingsMutation = useMutation({
    mutationFn: (settings: BoardSettings) => updateBoard(board.id, { settings }),
    onSuccess: invalidate,
  });

  const typeMutation = useMutation({
    mutationFn: (vars: { type: BoardType; settings?: BoardSettings }) =>
      updateBoard(board.id, { type: vars.type, settings: vars.settings }),
    onSuccess: invalidate,
  });

  const setYear = (y: number | null) => settingsMutation.mutate({ year: y });
  const setShowOverdue = (v: boolean) => settingsMutation.mutate({ showOverdue: v });

  function handleTypeChange(next: BoardType) {
    if (next === board.type) return;
    // Switching to a calendar board: send it sensible settings + open on the
    // week-grouped Kanban straight away.
    if (next === 'calendar') {
      typeMutation.mutate({ type: next, settings: { showOverdue: false } });
      setView('kanban');
      setGroupBy('week');
    } else {
      typeMutation.mutate({ type: next });
    }
  }

  // One-time heal: older calendar boards stored their year in localStorage
  // (per-device). If we find that but the server has no year yet, push it up so
  // every device — including mobile — sees the same calendar board.
  const backfilledRef = useRef(false);
  useEffect(() => {
    if (backfilledRef.current) return;
    if (board.settings?.year != null) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(`bink:board:${board.id}:year`);
    } catch {
      /* ignore */
    }
    const yr = parseInt(stored ?? '', 10);
    if (Number.isFinite(yr) && yr > 0) {
      backfilledRef.current = true;
      typeMutation.mutate({ type: 'calendar', settings: { year: yr, showOverdue: false } });
    }
  }, [board.id, board.settings?.year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setBoardName(board.name);
  }, [board.name]);

  const isCalendar = board.type === 'calendar';
  const openCard = board.columns.flatMap((c) => c.cards).find((c) => c.id === openCardId);

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Board header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-edge shrink-0">
        <LayoutGrid className="w-5 h-5 text-accent shrink-0" />
        {isRenaming ? (
          <input
            autoFocus
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            onBlur={() => {
              const trimmed = boardName.trim();
              if (trimmed && trimmed !== board.name) renameMutation.mutate(trimmed);
              else setBoardName(board.name);
              setIsRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setBoardName(board.name);
                setIsRenaming(false);
              }
            }}
            className="text-lg font-semibold bg-input-bg border border-accent rounded px-2 py-0.5 text-ink outline-none"
          />
        ) : (
          <h2
            onClick={() => setIsRenaming(true)}
            className="text-lg font-semibold text-ink truncate cursor-text"
            title="Click to rename"
          >
            {board.name}
          </h2>
        )}
        <button
          onClick={() => favoriteMutation.mutate(!board.isFavorite)}
          className={`p-1 rounded transition-colors ${
            board.isFavorite ? 'text-fav-text' : 'text-ink-faint hover:text-ink'
          }`}
          title={board.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
        >
          <Star className="w-4 h-4" fill={board.isFavorite ? 'currentColor' : 'none'} />
        </button>

        <div className="flex-1" />

        {isCalendar && year && (
          <span className="text-xs text-ink-muted px-2 py-0.5 rounded bg-muted-bg" title="This board shows every week of this year">
            {year}
          </span>
        )}
        {isCalendar && (
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-ink-muted hover:text-ink hover:bg-hover rounded-md transition-colors"
            title="Set this board's year and import weekly data"
          >
            <CalendarRange className="w-4 h-4" />
            <span className="hidden sm:inline">Year / import</span>
          </button>
        )}
        <ViewSwitcher
          view={view}
          onViewChange={setView}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
        />

        {/* Board "Purpose" (type) + intrinsic settings live here, demoted out of
            the toolbar since they're intrinsic and rarely changed. */}
        <BoardOptionsMenu
          type={board.type}
          onTypeChange={handleTypeChange}
          showOverdue={showOverdue}
          onShowOverdueChange={setShowOverdue}
        />
      </div>

      {/* Active view */}
      {view === 'kanban' &&
        (groupBy === 'week' ? (
          <KanbanWeekView board={board} onOpenCard={setOpenCardId} year={year} />
        ) : (
          <KanbanView board={board} onOpenCard={setOpenCardId} />
        ))}
      {view === 'calendar' && (
        <CalendarView
          board={board}
          onOpenCard={setOpenCardId}
          mode={calendarMode}
          onModeChange={setCalendarMode}
          showOverdue={showOverdue}
        />
      )}
      {view === 'table' && <TableView board={board} onOpenCard={setOpenCardId} />}
      {view === 'list' && <ListView board={board} onOpenCard={setOpenCardId} />}

      {openCard && (
        <CardModal
          board={board}
          card={openCard}
          onClose={() => setOpenCardId(null)}
          onOpenNote={(noteId) => {
            setOpenCardId(null);
            onOpenNote(noteId);
          }}
        />
      )}

      {showImport && (
        <YearImportDialog
          board={board}
          year={year}
          onSetYear={setYear}
          showOverdue={showOverdue}
          onSetShowOverdue={setShowOverdue}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
