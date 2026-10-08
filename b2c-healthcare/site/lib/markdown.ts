// Tiny Markdown subset for the static content files (workstream V): `##`/`###` headings, paragraphs,
// `-` lists, **bold** and [text](href) links. Pure data out, so React escapes everything on render.

export type Inline = { text: string; bold?: boolean; href?: string };
export type Block =
  | { type: 'h2' | 'h3'; text: string; id: string }
  | { type: 'p'; inline: Inline[] }
  | { type: 'ul'; items: Inline[][] };

/** Links must stay on the site or use a known scheme; anything else (javascript:, data:) is dropped. */
export function isSafeHref(href: string): boolean {
  return /^(\/(?!\/)|https:\/\/|mailto:|tel:|#)/.test(href);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of source.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ text: source.slice(last, index) });
    if (match[1] !== undefined) out.push({ text: match[1], bold: true });
    else if (match[2] !== undefined && match[3] !== undefined) {
      out.push(isSafeHref(match[3]) ? { text: match[2], href: match[3] } : { text: match[2] });
    }
    last = index + match[0].length;
  }
  if (last < source.length) out.push({ text: source.slice(last) });
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let items: Inline[][] | null = null;
  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'p', inline: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };
  const flushList = () => {
    if (items) blocks.push({ type: 'ul', items });
    items = null;
  };
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    const item = /^[-*]\s+(.+)$/.exec(line);
    if (line === '') {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const text = heading[2] ?? '';
      blocks.push({ type: heading[1]?.length === 2 ? 'h2' : 'h3', text, id: slugify(text) });
    } else if (item) {
      flushParagraph();
      (items ??= []).push(parseInline(item[1] ?? ''));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
