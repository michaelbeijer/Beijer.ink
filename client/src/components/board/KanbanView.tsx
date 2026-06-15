import { useState } from 'react';
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { createColumn } from '../../api/boards';
import { useDndBoard } from '../../hooks/useDndBoard';
import { BoardColumnView } from './BoardColumnView';
import { LABEL_COLORS } from '../../types/board';
import type { Board, Label } from '../../types/board';

interface KanbanViewProps {
  board: Board;
  onOpenCard: (cardId: string) => void;
}

/** Kanban grouped by the board's free-form lists (columns) — the original behaviour. */
export function KanbanView({ board, onOpenCard }: KanbanViewProps) {
  const queryClient = useQueryClient();
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');

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

  const addListMutation = useMutation({
    mutationFn: (name: string) => createColumn(board.id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board', board.id] }),
  });

  function handleAddList() {
    const name = newListName.trim();
    if (name) addListMutation.mutate(name);
    setNewListName('');
    setIsAddingList(false);
  }

  return (
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
                boardId={board.id}
                column={column}
                labels={board.labels}
                onOpenCard={(card) => onOpenCard(card.id)}
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
  );
}
