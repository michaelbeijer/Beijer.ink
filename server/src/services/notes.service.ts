import { prisma } from '../lib/prisma.js';

function extractTitle(content: string): string {
  // Try to get text from the first block element (h1-h6 or p)
  const match = content.match(/<(?:h[1-6]|p)[^>]*>(.*?)<\/(?:h[1-6]|p)>/);
  if (match) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text) return text;
  }
  // Fallback: strip all HTML tags and take first line
  const plain = content.replace(/<[^>]+>/g, '').trim();
  return plain.split('\n')[0]?.trim() || 'Untitled';
}

export async function getNotesInNotebook(notebookId: string) {
  return prisma.note.findMany({
    where: { notebookId },
    select: {
      id: true,
      title: true,
      content: true,
      isPinned: true,
      isFavorite: true,
      sortOrder: true,
      updatedAt: true,
      createdAt: true,
    },
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
  });
}

export async function getRootNotes() {
  return prisma.note.findMany({
    where: { notebookId: null },
    select: {
      id: true,
      title: true,
      content: true,
      isPinned: true,
      isFavorite: true,
      sortOrder: true,
      updatedAt: true,
      createdAt: true,
    },
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
  });
}

export async function getFavoriteNotes() {
  return prisma.note.findMany({
    where: { isFavorite: true },
    select: {
      id: true,
      title: true,
      content: true,
      isPinned: true,
      isFavorite: true,
      sortOrder: true,
      notebookId: true,
      updatedAt: true,
      createdAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }],
  });
}

export async function getNoteById(id: string) {
  return prisma.note.findUnique({
    where: { id },
    include: {
      notebook: { select: { id: true, name: true } },
    },
  });
}

export async function createNote(data: {
  content?: string;
  notebookId?: string;
}) {
  const content = data.content || '';
  const title = extractTitle(content);

  return prisma.note.create({
    data: {
      title,
      content,
      notebookId: data.notebookId,
    },
  });
}

export async function updateNote(
  id: string,
  data: {
    content?: string;
    notebookId?: string;
    isPinned?: boolean;
    isFavorite?: boolean;
    sortOrder?: number;
  }
) {
  const updateData: Record<string, unknown> = { ...data };

  if (data.content !== undefined) {
    updateData.title = extractTitle(data.content);
  }

  return prisma.note.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteNote(id: string) {
  await prisma.note.delete({ where: { id } });
}

export async function moveNote(id: string, notebookId: string | null) {
  return prisma.note.update({
    where: { id },
    data: { notebookId },
  });
}
