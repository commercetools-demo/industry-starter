import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export const TAG_CHIP =
  'inline-flex min-h-11 items-center gap-2 rounded-pill px-5 font-display text-sm font-semibold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action';

/** Topic label from `content.tags.<slug>`, or the raw slug for a tag without a label. */
export function useTagLabel(): (tag: string) => string {
  const t = useTranslations('content.tags');
  return (tag) => (t.has(tag) ? t(tag) : tag);
}

/** Topic chips of an article; each links to the blog filtered by that topic. */
export function TagLinks({ tags }: { tags: string[] }): ReactElement | null {
  const label = useTagLabel();
  if (tags.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
      {tags.map((tag) => (
        <li key={tag}>
          <Link href={{ pathname: '/blog', query: { tag } }} className={`${TAG_CHIP} bg-brand-100 text-brand-950 hover:bg-brand-200`}>
            {label(tag)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
