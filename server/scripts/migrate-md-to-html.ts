/**
 * One-time migration script: converts all note content from Markdown to HTML.
 *
 * Usage:  npx tsx scripts/migrate-md-to-html.ts
 *
 * Make sure DATABASE_URL is set (e.g. via .env in the server directory).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { marked } from 'marked';

const prisma = new PrismaClient();

// Configure marked for GitHub Flavored Markdown
marked.setOptions({ gfm: true, breaks: false });

function extractTitle(html: string): string {
  const match = html.match(/<(?:h[1-6]|p)[^>]*>(.*?)<\/(?:h[1-6]|p)>/);
  if (match) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text) return text;
  }
  return html.replace(/<[^>]+>/g, '').split('\n')[0]?.trim() || 'Untitled';
}

function looksLikeHtml(content: string): boolean {
  return /^<(?:h[1-6]|p|div|ul|ol|table|blockquote)\b/i.test(content.trim());
}

async function main() {
  const notes = await prisma.note.findMany({ select: { id: true, title: true, content: true } });
  console.log(`Found ${notes.length} notes.`);

  let converted = 0;
  let skipped = 0;

  for (const note of notes) {
    if (!note.content || looksLikeHtml(note.content)) {
      skipped++;
      continue;
    }

    const html = await marked(note.content);
    const title = extractTitle(html);

    await prisma.note.update({
      where: { id: note.id },
      data: { content: html, title },
    });
    converted++;
  }

  console.log(`Converted ${converted} notes, skipped ${skipped} (empty or already HTML).`);

  // Migrate scratchpads
  const scratchpads = await prisma.scratchpad.findMany({ select: { id: true, content: true } });
  let scratchConverted = 0;

  for (const pad of scratchpads) {
    if (!pad.content || looksLikeHtml(pad.content)) continue;

    const html = await marked(pad.content);
    await prisma.scratchpad.update({
      where: { id: pad.id },
      data: { content: html },
    });
    scratchConverted++;
  }

  console.log(`Converted ${scratchConverted} scratchpad(s).`);
  console.log('Migration complete.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
