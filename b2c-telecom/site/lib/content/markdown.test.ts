import { renderMarkdown, stripHtml } from './markdown';

describe('renderMarkdown', () => {
  it('prefixes internal links with the locale', () => {
    expect(renderMarkdown('[FAQ](/faq)', 'de-DE')).toContain('href="/de-DE/faq"');
    expect(renderMarkdown('[FAQ](/faq)', 'en-US')).toContain('href="/en-US/faq"');
  });

  it('leaves protocol-relative links untouched', () => {
    const html = renderMarkdown('[x](//example.com/a)', 'en-US');
    expect(html).toContain('href="//example.com/a"');
    expect(html).not.toContain('/en-US//example.com');
  });

  it('opens https links in a new tab with noopener noreferrer', () => {
    const html = renderMarkdown('[Pexels](https://www.pexels.com)', 'en-US');
    expect(html).toContain('href="https://www.pexels.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders headings and paragraphs', () => {
    const html = renderMarkdown('## Title\n\nText', 'en-US');
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<p>Text</p>');
  });
});

describe('stripHtml', () => {
  it('returns plain text with decoded entities and collapsed whitespace', () => {
    expect(stripHtml('<p>Fish &amp; <a href="/x">chips</a></p>\n<p>2 &lt; 3</p>')).toBe('Fish & chips 2 < 3');
  });
});
