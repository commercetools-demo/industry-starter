import type { Article } from '@/lib/content/journal-types';

// DRAFT: placeholder article for the demo. The owner replaces or removes it (SO-P5).
export const article: Article = {
  slug: 'descale-your-machine',
  status: 'published',
  topicTag: 'machines',
  tags: ['machines', 'care'],
  publishedAt: '2026-09-12',
  title: { 'en-US': 'How to descale your capsule machine' },
  description: {
    'en-US': 'A simple routine to keep your capsule machine running well, why limescale matters, and how to tell when it is time to descale.',
  },
  body: {
    'en-US': [
      { type: 'p', text: 'Limescale builds up inside every machine that heats water. Left alone it slows the flow and can change the taste of your coffee.' },
      { type: 'h2', id: 'when', text: 'When to descale' },
      { type: 'p', text: 'Follow the interval in your machine manual. A common rule of thumb is every three months, or sooner if you live where the water is hard.' },
      { type: 'h2', id: 'how', text: 'How to descale' },
      { type: 'ol', items: ['Empty the water tank and the drip tray.', 'Add the descaling solution and water as the product label says.', 'Run the machine through the descaling programme.', 'Rinse the tank and run clean water through twice.'] },
      { type: 'note', text: 'Always use a descaler made for your type of machine and follow the maker instructions.' },
      { type: 'cta', text: 'Browse machines', href: '/category/machines' },
    ],
  },
};
