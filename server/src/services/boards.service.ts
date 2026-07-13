import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import * as googleService from './google.service.js';

// Trello-style default label palette (names empty until the user names them)
const DEFAULT_LABEL_COLORS = ['green', 'yellow', 'orange', 'red', 'purple', 'blue'];

export type BoardType = 'calendar' | 'todo' | 'freeform';

// Each board type gets a starting list layout that fits its purpose.
// Calendar boards group by week (date-driven) so a single neutral list is enough.
const COLUMNS_BY_TYPE: Record<BoardType, string[]> = {
  calendar: ['Items'],
  todo: ['To do', 'Doing', 'Done'],
  freeform: ['To do', 'Doing', 'Done'],
};

interface Label {
  id: string;
  name: string;
  color: string;
}

interface BoardSettings {
  year?: number | null;
  showOverdue?: boolean;
  googleTaskListId?: string | null;
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
      type: true,
      sortOrder: true,
      isFavorite: true,
      settings: true,
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

/**
 * Dated cards across ALL boards, for the unified (umbrella) calendar.
 * Each card is returned with its owning board's id/name/type and label palette
 * so the calendar can render and colour-code it without a second fetch.
 */
export async function getCalendarCards(from?: string, to?: string) {
  let dueFilter: Prisma.DateTimeNullableFilter = { not: null };
  if (from || to) {
    dueFilter = {};
    if (from) dueFilter.gte = new Date(from);
    if (to) dueFilter.lte = new Date(to);
  }
  const cards = await prisma.card.findMany({
    where: { dueDate: dueFilter },
    orderBy: { dueDate: 'asc' },
    include: {
      note: { select: { id: true, title: true } },
      column: {
        select: {
          board: { select: { id: true, name: true, type: true, labels: true } },
        },
      },
    },
  });
  return cards.map((c) => {
    const { column, ...card } = c;
    return {
      ...card,
      boardId: column.board.id,
      boardName: column.board.name,
      boardType: column.board.type,
      boardLabels: column.board.labels,
    };
  });
}

export async function createBoard(data: {
  name?: string;
  type?: BoardType;
  settings?: BoardSettings;
}) {
  const labels: Label[] = DEFAULT_LABEL_COLORS.map((color) => ({
    id: randomUUID(),
    name: '',
    color,
  }));
  const type: BoardType = data.type ?? 'freeform';
  const columns = COLUMNS_BY_TYPE[type] ?? COLUMNS_BY_TYPE.freeform;
  // Sensible per-type defaults; an explicit settings payload overrides them.
  const defaultSettings: BoardSettings =
    type === 'todo' ? { showOverdue: true } : type === 'calendar' ? { showOverdue: false } : {};
  const settings: BoardSettings = { ...defaultSettings, ...(data.settings ?? {}) };

  return prisma.board.create({
    data: {
      name: data.name || 'Untitled board',
      type,
      labels: labels as unknown as Prisma.InputJsonValue,
      settings: settings as unknown as Prisma.InputJsonValue,
      columns: {
        create: columns.map((name, i) => ({ name, sortOrder: i })),
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
    type?: BoardType;
    isFavorite?: boolean;
    sortOrder?: number;
    labels?: Label[];
    settings?: BoardSettings;
  }
) {
  const { settings, labels, ...rest } = data;
  const updateData: Prisma.BoardUpdateInput = { ...rest } as Prisma.BoardUpdateInput;
  if (labels !== undefined) {
    updateData.labels = labels as unknown as Prisma.InputJsonValue;
  }
  // Merge settings so a partial PATCH (e.g. just showOverdue) never clobbers year.
  if (settings !== undefined) {
    const existing = await prisma.board.findUnique({ where: { id }, select: { settings: true } });
    const merged = { ...((existing?.settings as BoardSettings) ?? {}), ...settings };
    updateData.settings = merged as unknown as Prisma.InputJsonValue;
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

export async function deleteCard(id: string, userId?: string) {
  // Propagate the delete to Google Tasks when this card mirrors a task on a
  // linked board (best-effort — a Google failure must never block the local
  // delete). Only runs when we have a userId (i.e. the authed request path).
  if (userId) {
    try {
      const card = await prisma.card.findUnique({
        where: { id },
        select: {
          googleTaskId: true,
          column: { select: { board: { select: { settings: true } } } },
        },
      });
      const listId = (card?.column?.board?.settings as BoardSettings | null)?.googleTaskListId;
      if (card?.googleTaskId && listId) {
        await googleService.deleteTask(userId, listId, card.googleTaskId);
      }
    } catch {
      /* best-effort; fall through to the local delete regardless */
    }
  }
  await prisma.card.delete({ where: { id } });
}

// ─── Two-way Google Tasks sync ───────────────────────────────────────────
// Reconcile a linked board's cards with its Google Tasks list. Matched by the
// card's stored googleTaskId. Adds, edits and completions flow both ways
// (last edit wins by timestamp); deletes propagate (a task deleted in Google
// deletes its card here; a card deleted here already deleted its task via
// deleteCard above). The first sync simply MERGES both sides (no card has a
// task-id yet, so nothing is treated as deleted).

function localDateStr(d: Date | null): string | null {
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// Parse 'YYYY-MM-DD' back to a Date at local noon (so the calendar day is stable).
function dueToDate(due: string | null): Date | null {
  return due ? new Date(`${due}T12:00:00`) : null;
}

export async function syncGoogleTasks(userId: string, boardId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { columns: { orderBy: { sortOrder: 'asc' }, include: { cards: true } } },
  });
  if (!board) throw new Error('Board not found');
  const listId = (board.settings as BoardSettings | null)?.googleTaskListId;
  if (!listId) throw new Error('This board is not linked to a Google Tasks list.');
  const firstColumn = board.columns[0];
  if (!firstColumn) throw new Error('This board has no lists.');

  const gtasks = await googleService.listTasks(userId, listId);
  const gById = new Map(gtasks.map((t) => [t.id, t]));
  const matched = new Set<string>();
  const cards = board.columns.flatMap((c) => c.cards);

  for (const card of cards) {
    if (card.googleTaskId) {
      const g = gById.get(card.googleTaskId);
      if (!g || g.deleted) {
        // Deleted in Google → delete here (propagate).
        await prisma.card.delete({ where: { id: card.id } });
        continue;
      }
      matched.add(g.id);
      const cardDue = localDateStr(card.dueDate);
      const differs =
        g.title !== card.title ||
        (g.notes || '') !== (card.description || '') ||
        (g.due || null) !== (cardDue || null) ||
        g.completed !== card.dueDone;
      if (differs) {
        const gNewer = Boolean(g.updated) && new Date(g.updated).getTime() > card.updatedAt.getTime();
        if (gNewer) {
          await prisma.card.update({
            where: { id: card.id },
            data: {
              title: g.title,
              description: g.notes || '',
              dueDate: dueToDate(g.due),
              dueDone: g.completed,
            },
          });
        } else {
          await googleService.updateTask(userId, listId, g.id, {
            title: card.title,
            notes: card.description || '',
            due: cardDue,
            completed: card.dueDone,
          });
        }
      }
    } else {
      // Local-only card → create the Google task and remember its id.
      const created = await googleService.createTask(userId, listId, {
        title: card.title,
        notes: card.description || '',
        due: localDateStr(card.dueDate),
        completed: card.dueDone,
      });
      if (created) {
        await prisma.card.update({ where: { id: card.id }, data: { googleTaskId: created.id } });
      }
    }
  }

  // Google tasks with no matching card → create cards (append to the first list).
  let sortOrder = firstColumn.cards.length;
  for (const g of gtasks) {
    if (g.deleted || matched.has(g.id)) continue;
    await prisma.card.create({
      data: {
        columnId: firstColumn.id,
        title: g.title,
        description: g.notes || '',
        dueDate: dueToDate(g.due),
        dueDone: g.completed,
        googleTaskId: g.id,
        sortOrder: sortOrder++,
      },
    });
  }

  return getBoard(boardId);
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
