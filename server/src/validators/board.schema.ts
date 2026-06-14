import { z } from 'zod';

const labelSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string().min(1),
});

const checklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  done: z.boolean(),
});

export const createBoardSchema = z.object({
  name: z.string().min(1).optional(),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional(),
  isFavorite: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  labels: z.array(labelSchema).optional(),
});

export const createColumnSchema = z.object({
  name: z.string().min(1).optional(),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export const reorderColumnsSchema = z.object({
  columnIds: z.array(z.string().min(1)),
});

export const createCardSchema = z.object({
  title: z.string().optional(),
});

export const updateCardSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  dueDone: z.boolean().optional(),
  labelIds: z.array(z.string()).optional(),
  checklist: z.array(checklistItemSchema).optional(),
  noteId: z.string().min(1).nullable().optional(),
});

export const moveCardSchema = z.object({
  toColumnId: z.string().min(1),
  toIndex: z.number().int().min(0),
});
