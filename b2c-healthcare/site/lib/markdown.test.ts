import { describe, expect, it } from 'vitest';
import { isSafeHref, parseInline, parseMarkdown, slugify } from './markdown';

describe('lib/markdown', () => {
  it('parses headings with ids, paragraphs and lists', () => {
    expect(parseMarkdown('Intro line one\nline two\n\n## Our story\n\n- **One**\n- Two\n\n### Sub')).toEqual([
      { type: 'p', inline: [{ text: 'Intro line one line two' }] },
      { type: 'h2', text: 'Our story', id: 'our-story' },
      { type: 'ul', items: [[{ text: 'One', bold: true }], [{ text: 'Two' }]] },
      { type: 'h3', text: 'Sub', id: 'sub' },
    ]);
  });
  it('keeps safe links and drops unsafe ones, leaving the text', () => {
    expect(parseInline('see [us](/contact) or [x](javascript:alert(1)) now')).toEqual([
      { text: 'see ' },
      { text: 'us', href: '/contact' },
      { text: ' or ' },
      { text: 'x' },
      { text: ') now' },
    ]);
    expect(isSafeHref('//evil.example')).toBe(false);
    expect(isSafeHref('mailto:a@b.c')).toBe(true);
  });
  it('slugify', () => expect(slugify(' Hello, World! ')).toBe('hello-world'));
});
