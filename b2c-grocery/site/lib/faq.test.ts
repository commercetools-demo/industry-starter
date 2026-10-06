import { parseFaq } from './faq';

describe('parseFaq', () => {
  it('groups questions by topic with multi-paragraph answers', () => {
    const groups = parseFaq(
      ['intro ignored', '## Ordering', '### How?', 'Add to bag.', '', 'Then pay.', '### Why?', 'Because.', '## Delivery', '### Where?', 'Here.'].join('\n'),
    );
    expect(groups).toEqual([
      {
        topic: 'Ordering',
        items: [
          { q: 'How?', a: 'Add to bag.\n\nThen pay.' },
          { q: 'Why?', a: 'Because.' },
        ],
      },
      { topic: 'Delivery', items: [{ q: 'Where?', a: 'Here.' }] },
    ]);
  });

  it('drops topics without answered questions', () => {
    expect(parseFaq('## Empty\n### Unanswered\n')).toEqual([]);
  });

  it('parses the real FAQ files in both locales', async () => {
    const { getPage } = await import('./content');
    for (const locale of ['en-US', 'de-DE']) {
      const page = await getPage('faq', locale);
      const groups = parseFaq(page?.markdown ?? '');
      expect(groups.length).toBeGreaterThanOrEqual(3);
    }
  });
});
