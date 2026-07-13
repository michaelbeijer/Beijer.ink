import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, LayoutGrid } from 'lucide-react';
import { getBoard, updateBoard } from '../../api/boards';
import type { Board } from '../../types/board';
import { KanbanView } from './KanbanView';
import { CardModal } from './CardModal';

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

  return <BoardContent key={board.id} board={board} onOpenNote={onOpenNote} />;
}

function BoardContent({ board, onOpenNote }: { board: Board; onOpenNote: (noteId: string) => void }) {
  const queryClient = useQueryClient();
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [boardName, setBoardName] = useState(board.name);

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
