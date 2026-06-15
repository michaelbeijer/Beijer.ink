import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, LayoutGrid, CalendarRange } from 'lucide-react';
import { getBoard, updateBoard } from '../../api/boards';
import { useBoardViewPrefs } from '../../hooks/useBoardViewPrefs';
import { ViewSwitcher } from './ViewSwitcher';
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
  const queryClient = useQueryClient();
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [showImport, setShowImport] = useState(false);

  const { view, setView, groupBy, setGroupBy, calendarMode, setCalendarMode, year, setYear, showOverdue, setShowOverdue } =
    useBoardViewPrefs(boardId);

  const { data: board } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => getBoard(boardId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    queryClient.invalidateQueries({ queryKey: ['boards'] });
  };

  const favoriteMutation = useMutation({
    mutationFn: (isFavorite: boolean) => updateBoard(boardId, { isFavorite }),
    onSuccess: invalidate,
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateBoard(boardId, { name }),
    onSuccess: invalidate,
  });

  useEffect(() => {
    if (board) setBoardName(board.name);
  }, [board?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!board) {
    return (
      <div className="h-full flex items-center justify-center bg-surface">
        <div className="text-ink-muted">Loading board…</div>
      </div>
    );
  }

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
        {year && (
          <span className="text-xs text-ink-muted px-2 py-0.5 rounded bg-muted-bg" title="This board shows every week of this year">
            {year}
          </span>
        )}
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-ink-muted hover:text-ink hover:bg-hover rounded-md transition-colors"
          title="Set this board's year and import weekly data"
        >
          <CalendarRange className="w-4 h-4" />
          <span className="hidden sm:inline">Year / import</span>
        </button>
        <ViewSwitcher
          view={view}
          onViewChange={setView}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
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
