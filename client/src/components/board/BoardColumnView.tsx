import { useState, useRef, useEffect } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical, X } from 'lucide-react';
import type { Column, Card, Label } from '../../types/board';
import { createCard, updateColumn, deleteColumn } from '../../api/boards';
import { BoardCard } from './BoardCard';

interface BoardColumnViewProps {
  boardId: string;
  column: Column;
  labels: Label[];
  onOpenCard: (card: Card) => void;
}

export function BoardColumnView({ boardId, column, labels, onOpenCard }: BoardColumnViewProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  const addRef = useRef<HTMLTextAreaElement>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['board', boardId] });

  const addCardMutation = useMutation({
    mutationFn: (title: string) => createCard(column.id, title),
    onSuccess: invalidate,
  });

  const renameMutation = useMutation({
    mutationFn: (newName: string) => updateColumn(column.id, { name: newName }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteColumn(column.id),
    onSuccess: invalidate,
  });

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column', column },
  });

  const { setNodeRef: setListRef } = useDroppable({
    id: `list:${column.id}`,
    data: { type: 'column-list', columnId: column.id },
  });

  useEffect(() => {
    if (isAdding) addRef.current?.focus();
  }, [isAdding]);

  useEffect(() => {
    setName(column.name);
  }, [column.name]);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function handleAdd() {
    const title = newTitle.trim();
    if (title) addCardMutation.mutate(title);
    setNewTitle('');
    // keep composer open for rapid entry, like Trello
    addRef.current?.focus();
  }

  function handleRename() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) renameMutation.mutate(trimmed);
    else setName(column.name);
    setIsRenaming(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col w-72 shrink-0 max-h-full bg-panel border border-edge rounded-xl"
    >
      {/* Header (drag handle) */}
      <div className="flex items-center gap-1 px-2 py-2 group">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-ink-faint hover:text-ink cursor-grab active:cursor-grabbing"
          title="Drag list"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {isRenaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setName(column.name);
                setIsRenaming(false);
              }
            }}
            className="flex-1 min-w-0 px-1.5 py-0.5 text-sm font-semibold bg-input-bg border border-accent rounded text-ink outline-none"
          />
        ) : (
          <h3
            onClick={() => setIsRenaming(true)}
            className="flex-1 min-w-0 truncate text-sm font-semibold text-ink cursor-text"
            title={column.name}
          >
            {column.name}
          </h3>
        )}
        <span className="text-xs text-ink-faint px-1">{column.cards.length}</span>
        <button
          onClick={() => {
            if (
              column.cards.length === 0 ||
              confirm(`Delete list "${column.name}" and its ${column.cards.length} card(s)?`)
            ) {
              deleteMutation.mutate();
            }
          }}
          className="p-1 text-ink-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete list"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Cards */}
      <div ref={setListRef} className="flex-1 overflow-y-auto px-2 min-h-2">
        <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 pb-2">
            {column.cards.map((card) => (
              <BoardCard
                key={card.id}
                card={card}
                columnId={column.id}
                labels={labels}
                onClick={() => onOpenCard(card)}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      {/* Add card */}
      <div className="p-2 pt-1">
        {isAdding ? (
          <div>
            <textarea
              ref={addRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAdd();
                }
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewTitle('');
                }
              }}
              placeholder="Enter a title…"
              rows={2}
              className="w-full px-2 py-1.5 text-sm bg-card border border-edge rounded-lg text-ink placeholder:text-placeholder outline-none focus:border-accent resize-none"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={handleAdd}
                className="px-3 py-1 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent-hover"
              >
                Add card
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle('');
                }}
                className="p-1 text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 w-full px-2 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-hover rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add a card
          </button>
        )}
      </div>
    </div>
  );
}
