import type { Notebook } from '../types/notebook';

export interface NotebookWithDepth {
  notebook: Notebook;
  depth: number;
}

/**
 * Returns notebooks sorted in tree order (parents before children)
 * with a depth value for indentation.
 */
export function sortNotebooksTree(notebooks: Notebook[]): NotebookWithDepth[] {
  const childrenMap = new Map<string | null, Notebook[]>();
  for (const nb of notebooks) {
    const key = nb.parentId;
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(nb);
  }

  const result: NotebookWithDepth[] = [];

  function walk(parentId: string | null, depth: number) {
    const children = childrenMap.get(parentId);
    if (!children) return;
    for (const nb of children) {
      result.push({ notebook: nb, depth });
      walk(nb.id, depth + 1);
    }
  }

  walk(null, 0);
  return result;
}
