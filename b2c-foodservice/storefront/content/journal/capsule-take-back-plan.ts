import type { Article } from '@/lib/content/journal-types';

// DRAFT: a withdrawn article. The text is removed; the address redirects to the topic listing. SO-P5.
export const article: Article = {
  slug: 'capsule-take-back-plan',
  status: 'withdrawn',
  topicTag: 'capsules',
  tags: ['capsules'],
  publishedAt: '2026-07-01',
  title: { 'en-US': 'Our capsule take-back plan' },
  description: {
    'en-US': 'This article has been withdrawn. Browse the journal for current guides on capsules and the machines that use them.',
  },
  body: { 'en-US': [] },
};
