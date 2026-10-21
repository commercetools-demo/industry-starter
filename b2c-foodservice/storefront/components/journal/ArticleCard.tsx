import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import { resolveLocalized } from '@/lib/content/localized';
import type { Article } from '@/lib/content/journal-types';
import { articleHref } from '@/lib/routes';

/** One journal card: image 3:2, tags, date, title, description. Text that falls back to English carries lang="en". */
export default function ArticleCard({ article, locale, headingLevel = 2 }: { article: Article; locale: string; headingLevel?: 2 | 3 }) {
  const t = useTranslations('journal');
  const title = resolveLocalized(article.title, locale);
  const description = resolveLocalized(article.description, locale);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${article.publishedAt}T00:00:00Z`));
  const image = article.image;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface">
      <div className="aspect-[3/2] bg-canvas-2">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- images are resized at the image source, not by Next
          <img src={image.url} alt={resolveLocalized(image.alt, locale).value} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-ink-3">
            <Icon name="bean" size={40} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        {article.tags.length > 0 ? (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {article.tags.map((tag) => (
              <li key={tag} className="eyebrow">
                {t(`tags.${tag}`)}
              </li>
            ))}
          </ul>
        ) : null}
        <Heading lang={title.isFallback ? 'en' : undefined} className="m-0 font-display text-[19px] font-semibold leading-tight">
          <Link href={articleHref(article.slug)} className="hover:underline">
            {title.value}
          </Link>
        </Heading>
        <p lang={description.isFallback ? 'en' : undefined} className="m-0 text-[14px] text-ink-2">
          {description.value}
        </p>
        <p className="m-0 mt-auto pt-2 text-[13px] text-ink-2">
          <time dateTime={article.publishedAt}>{date}</time>
        </p>
      </div>
    </article>
  );
}
