import type { Block } from '@/lib/content/blocks';
import type { Localized } from '@/lib/content/localized';

/** The fixed taxonomy. Labels are `journal.tags.<key>` in the catalogues. */
export const JOURNAL_TAGS = ['brewing', 'capsules', 'machines', 'sourcing', 'subscriptions', 'care'] as const;
export type JournalTag = (typeof JOURNAL_TAGS)[number];

export interface Article {
  /** Lower-case, hyphens, 3 to 80 characters, unique. */
  slug: string;
  status: 'published' | 'withdrawn';
  /** Where a withdrawn article sends the reader. */
  topicTag: JournalTag;
  tags: JournalTag[];
  /** 'YYYY-MM-DD' */
  publishedAt: string;
  updatedAt?: string;
  /** Clean URL, no query string. */
  image?: { url: string; alt: Localized<string> };
  title: Localized<string>;
  /** 110 to 160 characters. */
  description: Localized<string>;
  /** Empty for withdrawn articles: the text is removed. */
  body: Localized<Block[]>;
}
