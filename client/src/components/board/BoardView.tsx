import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, LayoutGrid, RefreshCw } from 'lucide-react';
import { getBoard, updateBoard, syncGoogleTasks } from '../../api/boards';
import type { Board } from '../../types/board';
import { KanbanView } from './KanbanView';
import { CardModal } from './CardModal';

interface BoardViewProps {
  boardId: string;
  onOpenNote: (noteId: string) => void;
  searchCardId?: string | null;
  onSearchCardOpened?: () => void;
}

export function BoardView({ boardId, onOpenNote, searchCardId, onSearchCardOpened }: BoardViewProps) {
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

  return (
    <BoardContent
      key={board.id}
      board={board}
      onOpenNote={onOpenNote}
      searchCardId={searchCardId}
      onSearchCardOpened={onSearchCardOpened}
    />
  );
}

function BoardContent({
  board,
  onOpenNote,
  searchCardId,
  onSearchCardOpened,
}: {
  board: Board;
  onOpenNote: (noteId: string) => void;
  searchCardId?: string | null;
  onSearchCardOpened?: () => void;
}) {
  const queryClient = useQueryClient();
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [boardName, setBoardName] = useState(board.name);

  useEffect(() => {
    if (!searchCardId) return;
    const exists = board.columns.some((column) => column.cards.some((card) => card.id === searchCardId));
    if (exists) setOpenCardId(searchCardId);
    onSearchCardOpened?.();
  }, [board, searchCardId, onSearchCardOpened]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['board', board.id] });
    queryClient.invalidateQueries({ queryKey: ['boards'] });
  };

  // Google Tasks two-way sync (only for boards linked to a task list).
  const linked = Boolean(board.settings?.googleTaskListId);
  const syncMutation = useMutation({
    mutationFn: () => syncGoogleTasks(board.id),
    onSuccess: (fresh) => {
      queryClient.setQueryData(['board', board.id], fresh);
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
  // Auto-sync once when a linked board is opened. syncMutation is recreated each
  // render, so pull the mutate fn out and guard with a ref to run it a single time.
  const syncMutate = syncMutation.mutate;
  const autoSynced = useRef(false);
  useEffect(() => {
    if (linked && !autoSynced.current) {
      autoSynced.current = true;
      syncMutate();
    }
  }, [linked, syncMutate]);

  const favoriteMutation = useMutation({
    mutationFn: (isFavorite: boolean) => updateBoard(board.id, { isFavorite }),
    onSuccess: invalidate,
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateBoard(board.id, { name }),
    onSuccess: invalidate,
  });

  useEffect(() => {
    setBoardName(board.name);
  }, [board.name]);

  const openCard = board.columns.flatMap((c) => c.cards).find((c) => c.id === openCardId);

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Board header — just the title + favourite. A board is a plain kanban;
          anything calendar-shaped lives in the global All-Calendar. */}
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

        {linked && (
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md text-ink-muted hover:text-ink hover:bg-hover disabled:opacity-60"
            title="Sync this board with its linked Google Tasks list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing…' : 'Sync'}
          </button>
        )}
      </div>

      <KanbanView board={board} onOpenCard={setOpenCardId} />

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
    </div>
  );
}
