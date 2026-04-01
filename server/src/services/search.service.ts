import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

interface SearchFilters {
  notebookId?: string;
  limit: number;
  offset: number;
}

interface SearchResult {
  id: string;
  title: string;
  headline: string;
  notebookId: string | null;
  notebookName: string | null;
  rank: number;
  updatedAt: Date;
}

export async function searchNotes(query: string, filters: SearchFilters) {
  const { notebookId, limit, offset } = filters;

  const notebookFilter = notebookId
    ? Prisma.sql`AND n.notebook_id = ${notebookId}`
    : Prisma.empty;

  const tsquery = Prisma.sql`plainto_tsquery('english', ${query})`;

  // Strip HTML tags before building tsvectors — notes are stored as HTML
  // but to_tsvector needs plain text for correct tokenization.
  const stripHtml = Prisma.sql`regexp_replace(n.content, '<[^>]+>', ' ', 'g')`;

  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      n.id,
      n.title,
      n.notebook_id AS "notebookId",
      nb.name AS "notebookName",
      n.updated_at AS "updatedAt",
      ts_rank(
        setweight(to_tsvector('english', coalesce(n.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${stripHtml}, '')), 'B'),
        ${tsquery}
      ) AS rank,
      ts_headline(
        'english',
        ${stripHtml},
        ${tsquery},
        'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20, MaxFragments=2'
      ) AS headline
    FROM notes n
    LEFT JOIN notebooks nb ON nb.id = n.notebook_id
    WHERE (
      setweight(to_tsvector('english', coalesce(n.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(${stripHtml}, '')), 'B')
    ) @@ ${tsquery}
    ${notebookFilter}
    ORDER BY rank DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const countResult = await prisma.$queryRaw<[{ total: number }]>`
    SELECT count(*)::int AS total
    FROM notes n
    WHERE (
      setweight(to_tsvector('english', coalesce(n.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(${stripHtml}, '')), 'B')
    ) @@ ${tsquery}
    ${notebookFilter}
  `;

  return { results, total: countResult[0].total };
}
