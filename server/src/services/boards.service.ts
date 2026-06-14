import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// Trello-style default label palette (names empty until the user names them)
const DEFAULT_LABEL_COLORS = ['green', 'yellow', 'orange', 'red', 'purple', 'blue'];
const DEFAULT_COLUMNS = ['To do', 'Doing', 'Done'];

interface Label {
  id: string;
  name: string;
  color: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export async function getAllBoards() {
  return prisma.board.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      icon: true,
      sortOrder: true,
      isFavorite: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getBoard(id: string) {
  return prisma.board.findUnique({
    where: { id },
    include: {
      columns: {
        orderBy: { sortOrder: 'asc' },
        include: {
          cards: {
            orderBy: { sortOrder: 'asc' },
            include: {
              note: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });
}

export async function createBoard(data: { name?: string }) {
  const labels: Label[] = DEFAULT_LABEL_COLORS.map((color) => ({
    id: randomUUID(),
    name: '',
    color,
  }));

  return prisma.board.create({
    data: {
      name: data.name || 'Untitled board',
      labels: labels as unknown as Prisma.InputJsonValue,
      columns: {
        create: DEFAULT_COLUMNS.map((name, i) => ({ name, sortOrder: i })),
      },
    },
    include: {
      columns: { orderBy: { sortOrder: 'asc' }, include: { cards: true } },
    },
  });
}

export async function updateBoard(
  id: string,
  data: {
    name?: string;
    icon?: string;
    isFavorite?: boolean;
    sortOrder?: number;
    labels?: Label[];
  }
) {
  const updateData: Prisma.BoardUpdateInput = { ...data } as Prisma.BoardUpdateInput;
  if (data.labels !== undefined) {
    updateData.labels = data.labels as unknown as Prisma.InputJsonValue;
  }
  return prisma.board.update({ where: { id }, data: updateData });
}

export async function deleteBoard(id: string) {
  await prisma.board.delete({ where: { id } });
}

// ── Columns ──

export async function createColumn(boardId: string, data: { name?: string }) {
  const count = await prisma.boardColumn.count({ where: { boardId } });
  return prisma.boardColumn.create({
    data: {
      boardId,
      name: data.name || 'New list',
      sortOrder: count,
    },
    include: { cards: true },
  });
}

export async function updateColumn(id: string, data: { name?: string; sortOrder?: number }) {
  return prisma.boardColumn.update({ where: { id }, data });
}

export async function deleteColumn(id: string) {
  await prisma.boardColumn.delete({ where: { id } });
}

export async function reorderColumns(boardId: string, columnIds: string[]) {
  await prisma.$transaction(
    columnIds.map((id, i) =>
      prisma.boardColumn.update({
        where: { id },
        data: { sortOrder: i },
      })
    )
  );
  return getBoard(boardId);
}

// ── Cards ──

export async function createCard(columnId: string, data: { title?: string }) {
  const count = await prisma.card.count({ where: { columnId } });
  return prisma.card.create({
    data: {
      columnId,
      title: data.title || '',
      sortOrder: count,
    },
    include: { note: { select: { id: true, title: true } } },
  });
}

export async function updateCard(
  id: string,
  data: {
    title?: string;
    description?: string;
    dueDate?: string | null;
    dueDone?: boolean;
    labelIds?: string[];
    checklist?: ChecklistItem[];
    noteId?: string | null;
  }
) {
  const updateData: Record<string, unknown> = { ...data };
  if (data.dueDate !== undefined) {
    updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  }
  return prisma.card.update({
    where: { id },
    data: updateData,
    include: { note: { select: { id: true, title: true } } },
  });
}

export async function deleteCard(id: string) {
  await prisma.card.delete({ where: { id } });
}

/**
 * Move a card to a target column at a target index. Renumbers the affected
 * column(s) so sortOrder stays a dense 0..n-1 sequence (server authoritative).
 */
export async function moveCard(cardId: string, toColumnId: string, toIndex: number) {
  return prisma.$transaction(async (tx) => {
    const card = await tx.card.findUnique({ where: { id: cardId } });
    if (!card) throw new Error('Card not found');
    const fromColumnId = card.columnId;

    // Build the target column's new order (excluding the moved card, then inserting it)
    const targetCards = await tx.card.findMany({
      where: { columnId: toColumnId, id: { not: cardId } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
    const index = Math.min(Math.max(toIndex, 0), targetCards.length);
    const orderedIds = targetCards.map((c) => c.id);
    orderedIds.splice(index, 0, cardId);

    await Promise.all(
      orderedIds.map((id, i) =>
        tx.card.update({
          where: { id },
          data: id === cardId ? { sortOrder: i, columnId: toColumnId } : { sortOrder: i },
        })
      )
    );

    // If the card changed columns, close the gap in the source column
    if (fromColumnId !== toColumnId) {
      const sourceCards = await tx.card.findMany({
        where: { columnId: fromColumnId },
        orderBy: { sortOrder: 'asc' },
        select: { id: true },
      });
      await Promise.all(
        sourceCards.map((c, i) => tx.card.update({ where: { id: c.id }, data: { sortOrder: i } }))
      );
    }

    return tx.card.findUnique({
      where: { id: cardId },
      include: { note: { select: { id: true, title: true } } },
    });
  });
}
