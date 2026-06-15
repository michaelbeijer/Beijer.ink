import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateCard, createCard } from '../api/boards';
import type { Board, Card } from '../types/board';

/**
 * Shared card mutations for the date-driven board views (Calendar, week-Kanban,
 * Table, List). Optimistically patches the cached board so the move is instant,
 * then persists via the existing endpoints and refreshes the cache. Because every
 * view reads the same ['board', id] query, a change in one shows up in all.
 */
export function useBoardCardMutations(boardId: string) {
  const queryClient = useQueryClient();
  const key = ['board', boardId];

  const patchCache = useCallback(
    (cardId: string, patch: Partial<Card>) => {
      queryClient.setQueryData<Board>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          columns: old.columns.map((col) => ({
            ...col,
            cards: col.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
          })),
        };
      });
    },
    [queryClient, boardId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: key }),
    [queryClient, boardId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setCardDate = useCallback(
    async (cardId: string, iso: string | null) => {
      patchCache(cardId, { dueDate: iso });
      try {
        await updateCard(cardId, { dueDate: iso });
      } catch (err) {
        console.error('Failed to set card date:', err);
      } finally {
        invalidate();
      }
    },
    [patchCache, invalidate]
  );

  const setCardDone = useCallback(
    async (cardId: string, done: boolean) => {
      patchCache(cardId, { dueDone: done });
      try {
        await updateCard(cardId, { dueDone: done });
      } catch (err) {
        console.error('Failed to set card done:', err);
      } finally {
        invalidate();
      }
    },
    [patchCache, invalidate]
  );

  const setCardTitle = useCallback(
    async (cardId: string, title: string) => {
      patchCache(cardId, { title });
      try {
        await updateCard(cardId, { title });
      } catch (err) {
        console.error('Failed to set card title:', err);
      } finally {
        invalidate();
      }
    },
    [patchCache, invalidate]
  );

  /** Create a card in `columnId` (its home list) with an optional date. */
  const addCard = useCallback(
    async (columnId: string, title: string, iso: string | null) => {
      try {
        const card = await createCard(columnId, title);
        if (iso) await updateCard(card.id, { dueDate: iso });
      } catch (err) {
        console.error('Failed to add card:', err);
      } finally {
        invalidate();
      }
    },
    [invalidate]
  );

  return { setCardDate, setCardDone, setCardTitle, addCard, patchCache, invalidate };
}
