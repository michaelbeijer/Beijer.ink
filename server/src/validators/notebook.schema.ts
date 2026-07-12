import { z } from 'zod';

export const createNotebookSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().optional(),
  icon: z.string().optional(),
});

export const updateNotebookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().nullable().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isFavorite: z.boolean().optional(),
  publishTarget: z.boolean().optional(),
  publishBeijerterm: z.boolean().optional(),
});
