import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

interface SearchFilters {
  notebookId?: string;
  limit: number;
  offset: number;
}

export type SearchResultType = 'note' | 'scratchpad' | 'notebook' | 'board' | 'column' | 'card';

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  headline: string;
  context: string | null;
  notebookId: string | null;
  boardId: string | null;
  cardId: string | null;
  rank: number;
  updatedAt: Date;
}

/**
 * Search every durable, user-authored text source in Beijer.ink.
 *
 * PostgreSQL full-text search gives useful English word stemming/ranking, while
 * the literal `strpos` checks are deliberately always present. The latter make
 * stop words, short terms, identifiers, URLs and substrings work: searching
 * `887655` therefore matches `BRANTS66255344455-887655`.
 */
export async function searchAll(query: string, filters: SearchFilters) {
  const { notebookId, limit, offset } = filters;
  const trimmed = query.trim();
  const tsquery = Prisma.sql`plainto_tsquery('english', ${trimmed})`;
  const notebookFilter = notebookId
    ? Prisma.sql`AND n.notebook_id = ${notebookId}`
    : Prisma.empty;

  const noteText = Prisma.sql`concat_ws(' ', n.title, regexp_replace(n.content, '<[^>]+>', ' ', 'g'), n.subtitle, n.slug, coalesce(n.metadata::text, ''))`;
  const scratchpadText = Prisma.sql`regexp_replace(s.content, '<[^>]+>', ' ', 'g')`;
  const cardText = Prisma.sql`concat_ws(' ', c.title, regexp_replace(c.description, '<[^>]+>', ' ', 'g'), coalesce(c.checklist::text, ''))`;

  const rows = await prisma.$queryRaw<SearchResult[]>`
    SELECT id, type, title, headline, context, "notebookId", "boardId", "cardId", rank, "updatedAt"
    FROM (
      SELECT
        n.id,
        'note'::text AS type,
        n.title,
        substring(${noteText} from greatest(strpos(lower(${noteText}), lower(${trimmed})) - 80, 1) for 240) AS headline,
        coalesce(nb.name, 'Root') AS context,
        n.notebook_id AS "notebookId",
        NULL::text AS "boardId",
        NULL::text AS "cardId",
        (ts_rank(to_tsvector('english', ${noteText}), ${tsquery})
          + CASE WHEN strpos(lower(n.title), lower(${trimmed})) > 0 THEN 2 ELSE 0 END
          + CASE WHEN strpos(lower(${noteText}), lower(${trimmed})) > 0 THEN 1 ELSE 0 END)::float8 AS rank,
        n.updated_at AS "updatedAt"
      FROM notes n
      LEFT JOIN notebooks nb ON nb.id = n.notebook_id
      WHERE (
        to_tsvector('english', ${noteText}) @@ ${tsquery}
        OR strpos(lower(${noteText}), lower(${trimmed})) > 0
      )
      ${notebookFilter}

      UNION ALL

      SELECT
        '__scratchpad__',
        'scratchpad'::text,
        'Scratchpad',
        substring(${scratchpadText} from greatest(strpos(lower(${scratchpadText}), lower(${trimmed})) - 80, 1) for 240),
        'Scratchpad',
        NULL::text,
        NULL::text,
        NULL::text,
        (ts_rank(to_tsvector('english', ${scratchpadText}), ${tsquery})
          + CASE WHEN strpos(lower(${scratchpadText}), lower(${trimmed})) > 0 THEN 1 ELSE 0 END)::float8,
        s.updated_at
      FROM scratchpads s
      WHERE to_tsvector('english', ${scratchpadText}) @@ ${tsquery}
         OR strpos(lower(${scratchpadText}), lower(${trimmed})) > 0

      UNION ALL

      SELECT
        nb.id,
        'notebook'::text,
        nb.name,
        '',
        CASE WHEN parent.name IS NULL THEN 'Folder' ELSE concat('Folder in ', parent.name) END,
        nb.id,
        NULL::text,
        NULL::text,
        (3 + CASE WHEN lower(nb.name) = lower(${trimmed}) THEN 2 ELSE 0 END)::float8,
        nb.updated_at
      FROM notebooks nb
      LEFT JOIN notebooks parent ON parent.id = nb.parent_id
      WHERE strpos(lower(nb.name), lower(${trimmed})) > 0

      UNION ALL

      SELECT
        b.id,
        'board'::text,
        b.name,
        left(coalesce(b.labels::text, ''), 240),
        'Board',
        NULL::text,
        b.id,
        NULL::text,
        (3 + CASE WHEN lower(b.name) = lower(${trimmed}) THEN 2 ELSE 0 END)::float8,
        b.updated_at
      FROM boards b
      WHERE strpos(lower(concat_ws(' ', b.name, coalesce(b.labels::text, ''))), lower(${trimmed})) > 0

      UNION ALL

      SELECT
        bc.id,
        'column'::text,
        bc.name,
        '',
        concat('List in ', b.name),
        NULL::text,
        b.id,
        NULL::text,
        (2 + CASE WHEN lower(bc.name) = lower(${trimmed}) THEN 2 ELSE 0 END)::float8,
        bc.updated_at
      FROM board_columns bc
      JOIN boards b ON b.id = bc.board_id
      WHERE strpos(lower(bc.name), lower(${trimmed})) > 0

      UNION ALL

      SELECT
        c.id,
        'card'::text,
        c.title,
        substring(${cardText} from greatest(strpos(lower(${cardText}), lower(${trimmed})) - 80, 1) for 240),
        concat(b.name, ' · ', bc.name),
        NULL::text,
        b.id,
        c.id,
        (ts_rank(to_tsvector('english', ${cardText}), ${tsquery})
          + CASE WHEN strpos(lower(c.title), lower(${trimmed})) > 0 THEN 2 ELSE 0 END
          + CASE WHEN strpos(lower(${cardText}), lower(${trimmed})) > 0 THEN 1 ELSE 0 END)::float8,
        c.updated_at
      FROM cards c
      JOIN board_columns bc ON bc.id = c.column_id
      JOIN boards b ON b.id = bc.board_id
      WHERE to_tsvector('english', ${cardText}) @@ ${tsquery}
         OR strpos(lower(${cardText}), lower(${trimmed})) > 0
    ) combined
    ORDER BY rank DESC, "updatedAt" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const countRows = await prisma.$queryRaw<[{ total: number }]>`
    SELECT count(*)::int AS total
    FROM (
      SELECT n.id FROM notes n
      WHERE (to_tsvector('english', ${noteText}) @@ ${tsquery} OR strpos(lower(${noteText}), lower(${trimmed})) > 0)
      ${notebookFilter}
      UNION ALL
      SELECT s.id FROM scratchpads s
      WHERE to_tsvector('english', ${scratchpadText}) @@ ${tsquery} OR strpos(lower(${scratchpadText}), lower(${trimmed})) > 0
      UNION ALL
      SELECT nb.id FROM notebooks nb WHERE strpos(lower(nb.name), lower(${trimmed})) > 0
      UNION ALL
      SELECT b.id FROM boards b WHERE strpos(lower(concat_ws(' ', b.name, coalesce(b.labels::text, ''))), lower(${trimmed})) > 0
      UNION ALL
      SELECT bc.id FROM board_columns bc WHERE strpos(lower(bc.name), lower(${trimmed})) > 0
      UNION ALL
      SELECT c.id FROM cards c
      WHERE to_tsvector('english', ${cardText}) @@ ${tsquery} OR strpos(lower(${cardText}), lower(${trimmed})) > 0
    ) matches
  `;

  return { results: rows, total: countRows[0]?.total ?? 0 };
}
