import { Marked } from 'marked';
import type { ContentLocale } from './types';

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const parsers = new Map<ContentLocale, Marked>();

function parserFor(locale: ContentLocale): Marked {
  const existing = parsers.get(locale);
  if (existing) return existing;
  const marked = new Marked({
    gfm: true,
    renderer: {
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        let target = href;
        let extra = '';
        if (href.startsWith('/') && !href.startsWith('//')) {
          target = `/${locale}${href}`; // authors write /faq; readers stay in their locale
        } else if (/^https:\/\//i.test(href)) {
          extra = ' target="_blank" rel="noopener noreferrer"';
        }
        const titleAttr = title ? ` title="${escapeAttribute(title)}"` : '';
        return `<a href="${escapeAttribute(target)}"${titleAttr}${extra}>${text}</a>`;
      },
    },
  });
  parsers.set(locale, marked);
  return marked;
}

/**
 * Renders repo-authored (trusted) markdown. There is no sanitizer: never pass user input through it.
 * Internal links `/x` become `/<locale>/x`; `https://` links open in a new tab with `noopener noreferrer`.
 */
export function renderMarkdown(md: string, locale: ContentLocale): string {
  return parserFor(locale).parse(md, { async: false });
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/** Plain text of rendered HTML (for JSON-LD answers). */
export function stripHtml(html: string): string {
  return html
    .replace(/<\/(?:p|li|h[1-6]|div|ul|ol|blockquote)>|<br\s*\/?>/gi, ' ') // block ends separate words; inline tags do not
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();
}
