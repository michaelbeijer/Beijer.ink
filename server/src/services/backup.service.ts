import archiver from 'archiver';
import { prisma } from '../lib/prisma.js';

// Windows Explorer rejects the whole zip ("the Compressed (zipped) Folder is
// invalid") if a single entry breaks its file-name rules, so every name in the
// backup must be valid there: no reserved characters or device names, no
// trailing dots or spaces, and short enough to extract under the 260-char path
// limit once the destination folder is added.
const MAX_NAME_CHARS = 80;
const MAX_FOLDER_CHARS = 40;
const MAX_DIR_CHARS = 120;
const MAX_PATH_CHARS = 180;
// Windows reserves these device names even with an extension ("aux.txt").
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(?=\.|$)/i;

function sanitizeFilename(name: string, maxChars = MAX_NAME_CHARS): string {
  const chars = Array.from(
    name
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim(),
  );
  // Array.from splits by code point, so truncation never cuts an emoji in half.
  const clean = chars.slice(0, maxChars).join('').replace(/[. ]+$/, '').replace(WINDOWS_RESERVED, '$1_');
  return clean || 'Untitled';
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.7}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 12px;text-align:left}th{background:#f5f5f5;font-weight:600}
code{background:#f5f5f5;padding:1px 4px;border-radius:3px;font-family:ui-monospace,SFMono-Regular,monospace;font-size:0.9em}
pre{background:#f5f5f5;padding:12px 16px;border-radius:6px;overflow-x:auto}pre code{background:none;padding:0}
blockquote{border-left:3px solid #ddd;padding-left:12px;color:#666;margin:0.75em 0}
h1{font-size:1.5em}h2{font-size:1.3em}h3{font-size:1.15em}
a{color:#2563eb;text-decoration:underline}hr{border:none;border-top:1px solid #ddd;margin:1.5em 0}
ul{list-style:disc;padding-left:1.5em}ol{list-style:decimal;padding-left:1.5em}
img{max-width:100%;border-radius:6px}</style>
</head><body>${bodyHtml}</body></html>`;
}

export function getBackupFilename(date = new Date()): string {
  return `beijer-ink-backup-${date.toISOString().slice(0, 10)}.zip`;
}

export async function createBackupArchive() {
  const [notebooks, notes, scratchpad] = await Promise.all([
    prisma.notebook.findMany({ select: { id: true, name: true, parentId: true } }),
    prisma.note.findMany({ select: { title: true, content: true, notebookId: true } }),
    prisma.scratchpad.findFirst({ select: { content: true } }),
  ]);

  // Build notebook ID -> folder path map.
  const notebookMap = new Map(notebooks.map((nb) => [nb.id, nb]));
  const namesCache = new Map<string, string[]>();
  const pathCache = new Map<string, string>();

  function getNotebookNames(id: string): string[] {
    if (namesCache.has(id)) return namesCache.get(id)!;
    const nb = notebookMap.get(id);
    if (!nb) return [];
    const names = [...(nb.parentId ? getNotebookNames(nb.parentId) : []), nb.name];
    namesCache.set(id, names);
    return names;
  }

  // One folder-name limit for the whole tree, shared out across its depth, so a
  // notebook gets the same folder name whichever of its children is exported.
  const maxDepth = notebooks.reduce((max, nb) => Math.max(max, getNotebookNames(nb.id).length), 1);
  const folderChars = Math.max(8, Math.min(MAX_FOLDER_CHARS, Math.floor(MAX_DIR_CHARS / maxDepth) - 1));

  function getNotebookPath(id: string): string {
    if (pathCache.has(id)) return pathCache.get(id)!;
    const fullPath = getNotebookNames(id).map((name) => sanitizeFilename(name, folderChars)).join('/');
    pathCache.set(id, fullPath);
    return fullPath;
  }

  const archive = archiver('zip', { zlib: { level: 9 } });

  // Track used filenames per directory to handle duplicates. Compared
  // case-insensitively, because on Windows "Note" and "note" are the same file.
  const usedNames = new Map<string, Set<string>>();

  function uniqueName(dir: string, base: string): string {
    const key = dir.toLowerCase();
    if (!usedNames.has(key)) usedNames.set(key, new Set());
    const names = usedNames.get(key)!;
    let name = base;
    let counter = 2;
    while (names.has(name.toLowerCase())) {
      name = `${base} (${counter++})`;
    }
    names.add(name.toLowerCase());
    return name;
  }

  // Add empty folders for notebooks with no notes.
  const notebooksWithNotes = new Set(notes.filter((note) => note.notebookId).map((note) => note.notebookId));
  for (const notebook of notebooks) {
    if (!notebooksWithNotes.has(notebook.id)) {
      const folderPath = getNotebookPath(notebook.id);
      archive.append('', { name: `${folderPath}/` });
    }
  }

  // Add notes as .html files.
  for (const note of notes) {
    const dir = note.notebookId ? getNotebookPath(note.notebookId) : '';
    // Fit the whole entry path (folder + name + " (99)" + ".html") in the budget.
    const room = MAX_PATH_CHARS - (dir ? dir.length + 1 : 0) - ' (99).html'.length;
    const baseName = sanitizeFilename(note.title, Math.max(20, Math.min(MAX_NAME_CHARS, room)));
    const fileName = uniqueName(dir, baseName);
    const filePath = dir ? `${dir}/${fileName}.html` : `${fileName}.html`;
    archive.append(wrapHtml(note.title, note.content), { name: filePath });
  }

  // Add scratchpad as a file at the root.
  if (scratchpad?.content) {
    archive.append(wrapHtml('Scratchpad', scratchpad.content), { name: 'Scratchpad.html' });
  }

  archive.finalize();
  return archive;
}
