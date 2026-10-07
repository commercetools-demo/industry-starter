export interface FaqItem {
  q: string;
  /** Plain text; paragraphs are separated by a blank line. */
  a: string;
}
export interface FaqGroup {
  topic: string;
  items: FaqItem[];
}

/** Parses `## Topic` / `### Question` + answer paragraphs. Text before the first topic and empty questions are ignored. */
export function parseFaq(markdown: string): FaqGroup[] {
  const groups: FaqGroup[] = [];
  let group: FaqGroup | undefined;
  let item: { q: string; lines: string[] } | undefined;

  const closeItem = () => {
    if (group && item) {
      const a = item.lines.join('\n').trim();
      if (a) group.items.push({ q: item.q, a });
    }
    item = undefined;
  };

  for (const line of markdown.split(/\r?\n/)) {
    const topic = /^##\s+(.+?)\s*$/.exec(line);
    const question = /^###\s+(.+?)\s*$/.exec(line);
    if (topic) {
      closeItem();
      group = { topic: topic[1], items: [] };
      groups.push(group);
    } else if (question) {
      closeItem();
      item = { q: question[1], lines: [] };
    } else if (item) {
      item.lines.push(line);
    }
  }
  closeItem();
  return groups.filter((g) => g.items.length > 0);
}
