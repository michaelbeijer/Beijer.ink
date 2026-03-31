export function getPreview(content: string, maxLength = 120): string {
  // Remove the first block element (title) and extract remaining text
  const withoutFirstBlock = content.replace(/^<(h[1-6]|p)[^>]*>.*?<\/\1>/, '');
  const text = withoutFirstBlock
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
