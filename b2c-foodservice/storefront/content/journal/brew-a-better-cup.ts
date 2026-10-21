import type { Article } from '@/lib/content/journal-types';

// DRAFT: placeholder article for the demo. The owner replaces or removes it (SO-P5).
export const article: Article = {
  slug: 'brew-a-better-cup',
  status: 'published',
  topicTag: 'brewing',
  tags: ['brewing', 'care'],
  publishedAt: '2026-10-02',
  updatedAt: '2026-10-09',
  title: { 'en-US': 'Five small habits for a better cup at home' },
  description: {
    'en-US': 'Fresh beans, clean equipment and the right water make more difference than any gadget. Five habits worth building.',
  },
  body: {
    'en-US': [
      { type: 'p', text: 'You do not need special gear to make good coffee at home. A few habits matter more than the machine.' },
      { type: 'h2', id: 'habits', text: 'The five habits' },
      { type: 'ol', items: ['Buy beans in amounts you finish within a few weeks.', 'Store them airtight, away from heat and light.', 'Grind just before brewing.', 'Use clean, fresh-tasting water.', 'Keep your equipment clean, and descale on schedule.'] },
      { type: 'h2', id: 'taste', text: 'Taste and adjust' },
      { type: 'p', text: 'If a cup tastes bitter, try a coarser grind or a shorter brew. If it tastes sour or thin, go finer or brew a little longer. Change one thing at a time.' },
    ],
  },
};
