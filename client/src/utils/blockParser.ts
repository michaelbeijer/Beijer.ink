export interface Block {
  html: string;
  tag: string;
}

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'blockquote', 'pre', 'hr', 'div',
]);

export function splitBlocks(html: string): Block[] {
  if (!html) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const children = doc.body.childNodes;
  const blocks: Block[] = [];

  for (let i = 0; i < children.length; i++) {
    const node = children[i];

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      blocks.push({ html: el.outerHTML, tag });
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        blocks.push({ html: `<p>${text}</p>`, tag: 'p' });
      }
    }
  }

  return blocks;
}

export function joinBlocks(blocks: Block[]): string {
  return blocks.map((b) => b.html).join('');
}
