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
    ? Prisma.sql`AND notebook_id = ${notebookId}`
    : Prisma.empty;

  const tsquery = Prisma.sql`plainto_tsquery('english', ${query})`;

  // Strip HTML tags before building tsvectors — notes are stored as HTML
  // but to_tsvector needs plain text for correct tokenization.
  const noteStripHtml = Prisma.sql`regexp_replace(n.content, '<[^>]+>', ' ', 'g')`;
  const spStripHtml = Prisma.sql`regexp_replace(s.content, '<[^>]+>', ' ', 'g')`;

  // Search notes + scratchpad via UNION ALL, then sort/paginate the combined results
  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT id, title, "notebookId", "notebookName", "updatedAt", rank, headline
    FROM (
      SELECT
        n.id,
        n.title,
        n.notebook_id AS "notebookId",
        nb.name AS "notebookName",
        n.updated_at AS "updatedAt",
        ts_rank(
          setweight(to_tsvector('english', coalesce(n.title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(${noteStripHtml}, '')), 'B'),
          ${tsquery}
        ) AS rank,
        ts_headline(
          'english',
          ${noteStripHtml},
          ${tsquery},
          'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20, MaxFragments=2'
        ) AS headline
      FROM notes n
      LEFT JOIN notebooks nb ON nb.id = n.notebook_id
      WHERE (
        setweight(to_tsvector('english', coalesce(n.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${noteStripHtml}, '')), 'B')
      ) @@ ${tsquery}
      ${notebookFilter}

      UNION ALL

      SELECT
        '__scratchpad__' AS id,
        'Scratchpad' AS title,
        NULL AS "notebookId",
        'Scratchpad' AS "notebookName",
        s.updated_at AS "updatedAt",
        ts_rank(
          to_tsvector('english', coalesce(${spStripHtml}, '')),
          ${tsquery}
        ) AS rank,
        ts_headline(
          'english',
          ${spStripHtml},
          ${tsquery},
          'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20, MaxFragments=2'
        ) AS headline
      FROM scratchpads s
      WHERE to_tsvector('english', coalesce(${spStripHtml}, '')) @@ ${tsquery}
    ) combined
    ORDER BY rank DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const countResult = await prisma.$queryRaw<[{ total: number }]>`
    SELECT (notes_count + sp_count)::int AS total
    FROM (
      SELECT count(*) AS notes_count
      FROM notes n
      WHERE (
        setweight(to_tsvector('english', coalesce(n.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${noteStripHtml}, '')), 'B')
      ) @@ ${tsquery}
      ${notebookFilter}
    ) nc,
    (
      SELECT count(*) AS sp_count
      FROM scratchpads s
      WHERE to_tsvector('english', coalesce(${spStripHtml}, '')) @@ ${tsquery}
    ) sc
  `;

  return { results, total: countResult[0].total };
}
