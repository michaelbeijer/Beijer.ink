import { prisma } from '../lib/prisma.js';

export async function getAllNotebooks() {
  return prisma.notebook.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { notes: true } },
    },
  });
}

export async function createNotebook(data: { name: string; parentId?: string; icon?: string }) {
  return prisma.notebook.create({
    data: {
      name: data.name,
      parentId: data.parentId || null,
      icon: data.icon || 'folder',
    },
  });
}

export async function updateNotebook(
  id: string,
  data: { name?: string; parentId?: string | null; icon?: string; sortOrder?: number; isFavorite?: boolean; publishTarget?: boolean }
) {
  return prisma.notebook.update({
    where: { id },
    data,
  });
}

export async function deleteNotebook(id: string) {
  await prisma.notebook.delete({ where: { id } });
}
