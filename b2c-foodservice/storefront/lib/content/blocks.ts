/** Page bodies are structured blocks, never HTML. */
export type Block =
  | { type: 'h2'; id: string; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string } // may contain tokens {{...}}
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'note'; text: string }
  | { type: 'cta'; text: string; href: string }; // internal app path (no locale) or https URL

export const TOKEN_NAMES = ['freeShipping', 'collectMinutes', 'returnDays', 'supportEmail', 'supportPhone'] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];
export type ContentFigures = Record<TokenName, string>;

const TOKEN_RE = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

/** Replaces `{{name}}` with the figure. An unknown token is left out rather than shown raw. */
export function renderTokens(text: string, figures: Partial<Record<string, string>>): string {
  return text.replace(TOKEN_RE, (_m, name: string) => figures[name] ?? '');
}

/** Every token name used in a text (for the content validity test). */
export function tokensIn(text: string): string[] {
  return [...text.matchAll(TOKEN_RE)].map((m) => m[1]);
}

/** All strings of a block list, for tokens, search and JSON-LD. */
export function blockTexts(blocks: Block[]): string[] {
  return blocks.flatMap((b) => {
    switch (b.type) {
      case 'ul':
      case 'ol':
        return b.items;
      case 'h3':
      case 'p':
      case 'h2':
      case 'note':
      case 'cta':
        return [b.text];
    }
  });
}

/** Plain text of a block list with tokens replaced (FAQPage JSON-LD answers, article description checks). */
export function flattenBlocks(blocks: Block[], figures: Partial<Record<string, string>>): string {
  return blockTexts(blocks)
    .map((t) => renderTokens(t, figures))
    .join(' ');
}

export function headingsOf(blocks: Block[]): Array<{ id: string; text: string }> {
  return blocks.flatMap((b) => (b.type === 'h2' ? [{ id: b.id, text: b.text }] : []));
}
