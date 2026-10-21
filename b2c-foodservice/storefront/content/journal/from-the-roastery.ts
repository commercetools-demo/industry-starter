import type { Article } from '@/lib/content/journal-types';

// DRAFT: placeholder article for the demo, deliberately without tags so the related block is omitted. SO-P5.
export const article: Article = {
  slug: 'from-the-roastery',
  status: 'published',
  topicTag: 'sourcing',
  tags: [],
  publishedAt: '2026-08-20',
  title: { 'en-US': 'A note from the roastery' },
  description: {
    'en-US': 'Why we started Malva Coffee, what we care about when we choose a coffee, and what you can expect from us as a shop.',
  },
  body: {
    'en-US': [
      { type: 'p', text: 'This is a short note about what we are trying to do. We want to make it easy to find a coffee you enjoy and easy to make it well.' },
      { type: 'p', text: 'We will use this journal for guides and stories. If there is something you would like us to write about, tell us.' },
      { type: 'cta', text: 'Contact us', href: '/contact' },
    ],
  },
};
