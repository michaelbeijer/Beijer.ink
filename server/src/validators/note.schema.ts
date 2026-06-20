import { z } from 'zod';

export const createNoteSchema = z.object({
  content: z.string().optional(),
  notebookId: z.string().min(1).optional(),
});

export const updateNoteSchema = z.object({
  content: z.string().optional(),
  notebookId: z.string().optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  // autofingers publishing fields
  subtitle: z.string().max(300).nullable().optional(),
  slug: z.string().max(200).nullable().optional(),
});

export const moveNoteSchema = z.object({
  notebookId: z.string().min(1).nullable(),
});
