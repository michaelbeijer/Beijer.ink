import { useState, useRef, useEffect, useCallback } from 'react';
import {
  useSensors,
  useSensor,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { moveCard, reorderColumns } from '../api/boards';
import type { Board, Card, Column } from '../types/board';

type DragData =
  | { type: 'card'; card: Card; columnId: string }
  | { type: 'column'; column: Column }
  | { type: 'column-list'; columnId: string };

/**
 * Encapsulates all kanban drag-and-drop. Owns a local copy of the columns so
 * cards/columns reposition live during a drag, then persists to the server
 * (which stays authoritative on ordering) and refreshes the cached board.
 */
export function useDndBoard(board: Board | undefined) {
  const queryClient = useQueryClient();
  const [columns, setColumns] = useState<Column[]>(board?.columns ?? []);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const isDragging = useRef(false);

  // Keep local state in sync with the server, except while a drag is in flight.
  useEffect(() => {
    if (!isDragging.current && board) {
      setColumns(board.columns);
    }
  }, [board]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const boardId = board?.id;

  const findCardColumn = useCallback(
    (cardId: string) => columns.find((col) => col.cards.some((c) => c.id === cardId)),
    [columns]
  );

  const resolveColumnId = useCallback(
    (data: DragData | undefined, overId: string | null): string | null => {
      if (!data) return null;
      if (data.type === 'card') return data.columnId;
      if (data.type === 'column') return overId;
      if (data.type === 'column-list') return data.columnId;
      return null;
    },
    []
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    isDragging.current = true;
    const data = event.active.data.current as DragData | undefined;
    if (data?.type === 'card') setActiveCard(data.card);
    else if (data?.type === 'column') setActiveColumn(data.column);
  }, []);

  // Move a card into another column live, so it visually appears there mid-drag.
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;
      const activeData = active.data.current as DragData | undefined;
      if (activeData?.type !== 'card') return;

      const overData = over.data.current as DragData | undefined;
      const fromColId = findCardColumn(String(active.id))?.id;
      const toColId = resolveColumnId(overData, String(over.id));
      if (!fromColId || !toColId || fromColId === toColId) return;

      setColumns((prev) => {
        const from = prev.find((c) => c.id === fromColId);
        const to = prev.find((c) => c.id === toColId);
        if (!from || !to) return prev;
        const moving = from.cards.find((c) => c.id === active.id);
        if (!moving) return prev;

        // Insert before the hovered card, or append when over the column itself.
        let insertAt = to.cards.length;
        if (overData?.type === 'card') {
          const idx = to.cards.findIndex((c) => c.id === over.id);
          if (idx !== -1) insertAt = idx;
        }

        return prev.map((col) => {
          if (col.id === fromColId) {
            return { ...col, cards: col.cards.filter((c) => c.id !== active.id) };
          }
          if (col.id === toColId) {
            const next = [...col.cards];
            next.splice(insertAt, 0, { ...moving, columnId: toColId });
            return { ...col, cards: next };
          }
          return col;
        });
      });
    },
    [findCardColumn, resolveColumnId]
  );

  const finish = useCallback(() => {
    isDragging.current = false;
    setActiveCard(null);
    setActiveColumn(null);
    if (boardId) queryClient.invalidateQueries({ queryKey: ['board', boardId] });
  }, [boardId, queryClient]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      const activeData = active.data.current as DragData | undefined;

      if (!over || !activeData || !boardId) {
        finish();
        return;
      }

      try {
        if (activeData.type === 'column') {
          const overData = over.data.current as DragData | undefined;
          const overColId = overData?.type === 'card' ? overData.columnId : String(over.id);
          const oldIndex = columns.findIndex((c) => c.id === active.id);
          const newIndex = columns.findIndex((c) => c.id === overColId);
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const reordered = arrayMove(columns, oldIndex, newIndex);
            setColumns(reordered);
            await reorderColumns(boardId, reordered.map((c) => c.id));
          }
        } else if (activeData.type === 'card') {
          const overData = over.data.current as DragData | undefined;
          const targetColId = resolveColumnId(overData, String(over.id)) ?? activeData.columnId;
          const targetCol = columns.find((c) => c.id === targetColId);
          if (targetCol) {
            const oldIndex = targetCol.cards.findIndex((c) => c.id === active.id);
            let newIndex =
              overData?.type === 'card'
                ? targetCol.cards.findIndex((c) => c.id === over.id)
                : targetCol.cards.length - 1;
            if (newIndex < 0) newIndex = targetCol.cards.length - 1;

            if (oldIndex !== -1 && oldIndex !== newIndex) {
              const reordered = arrayMove(targetCol.cards, oldIndex, newIndex);
              setColumns((prev) =>
                prev.map((c) => (c.id === targetColId ? { ...c, cards: reordered } : c))
              );
              await moveCard(String(active.id), targetColId, newIndex);
            } else {
              // Position unchanged within the array, but the column may have changed.
              await moveCard(String(active.id), targetColId, oldIndex === -1 ? newIndex : oldIndex);
            }
          }
        }
      } catch (err) {
        console.error('Board drag failed:', err);
      } finally {
        finish();
      }
    },
    [boardId, columns, resolveColumnId, finish]
  );

  const handleDragCancel = useCallback(() => {
    isDragging.current = false;
    setActiveCard(null);
    setActiveColumn(null);
    if (board) setColumns(board.columns);
  }, [board]);

  return {
    columns,
    sensors,
    activeCard,
    activeColumn,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
