import { useState, useEffect } from 'react';
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Star, LayoutGrid } from 'lucide-react';
import { getBoard, createColumn, updateBoard } from '../../api/boards';
import { useDndBoard } from '../../hooks/useDndBoard';
import { BoardColumnView } from './BoardColumnView';
import { CardModal } from './CardModal';
import { LABEL_COLORS } from '../../types/board';
import type { Label } from '../../types/board';

interface BoardViewProps {
  boardId: string;
  onOpenNote: (noteId: string) => void;
}

export function BoardView({ boardId, onOpenNote }: BoardViewProps) {
  const queryClient = useQueryClient();
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [boardName, setBoardName] = useState('');

  const { data: board } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => getBoard(boardId),
  });

  const {
    columns,
    sensors,
    activeCard,
    activeColumn,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useDndBoard(board);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['board', boardId] });

  const addListMutation = useMutation({
    mutationFn: (name: string) => createColumn(boardId, name),
    onSuccess: invalidate,
  });

  const favoriteMutation = useMutation({
    mutationFn: (isFavorite: boolean) => updateBoard(boardId, { isFavorite }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateBoard(boardId, { name }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
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

  function handleAddList() {
    const name = newListName.trim();
    if (name) addListMutation.mutate(name);
    setNewListName('');
    setIsAddingList(false);
  }

  const openCard = columns.flatMap((c) => c.cards).find((c) => c.id === openCardId);

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
      </div>

      {/* Columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 min-h-0 overflow-x-auto p-4">
          <div className="flex items-start gap-3 h-full">
            <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              {columns.map((column) => (
                <BoardColumnView
                  key={column.id}
                  boardId={boardId}
                  column={column}
                  labels={board.labels}
                  onOpenCard={(card) => setOpenCardId(card.id)}
                />
              ))}
            </SortableContext>

            {/* Add a list */}
            <div className="w-72 shrink-0">
              {isAddingList ? (
                <div className="bg-panel border border-edge rounded-xl p-2">
                  <input
                    autoFocus
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddList();
                      if (e.key === 'Escape') {
                        setIsAddingList(false);
                        setNewListName('');
                      }
                    }}
                    placeholder="Enter list title…"
                    className="w-full px-2 py-1.5 text-sm bg-input-bg border border-edge rounded-lg text-ink placeholder:text-placeholder outline-none focus:border-accent"
                  />
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={handleAddList}
                      className="px-3 py-1 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent-hover"
                    >
                      Add list
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingList(false);
                        setNewListName('');
                      }}
                      className="p-1 text-ink-muted hover:text-ink"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingList(true)}
                  className="flex items-center gap-1.5 w-full px-3 py-2.5 text-sm text-ink-muted bg-panel/60 hover:bg-panel border border-edge rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add a list
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Drag preview */}
        <DragOverlay>
          {activeCard ? (
            <div className="bg-card border border-edge rounded-lg px-3 py-2 shadow-lg w-64 rotate-2">
              {activeCard.labelIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {activeCard.labelIds
                    .map((id) => board.labels.find((l) => l.id === id))
                    .filter((l): l is Label => Boolean(l))
                    .map((l) => (
                      <span
                        key={l.id}
                        className="h-2 rounded-full"
                        style={{ backgroundColor: LABEL_COLORS[l.color] ?? l.color, minWidth: '2rem' }}
                      />
                    ))}
                </div>
              )}
              <p className="text-sm text-ink">{activeCard.title || 'Untitled card'}</p>
            </div>
          ) : activeColumn ? (
            <div className="w-72 bg-panel border border-edge rounded-xl p-2 shadow-lg rotate-1">
              <h3 className="text-sm font-semibold text-ink px-1">{activeColumn.name}</h3>
              <p className="text-xs text-ink-faint px-1">{activeColumn.cards.length} card(s)</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
