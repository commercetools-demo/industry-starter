import Image from 'next/image';
import { Fragment } from 'react';
import { buttonClasses } from '@/components/ui/Button';
import { HOME_CONTENT, headlineLines, pick } from '@/content/home';
import { Link } from '@/i18n/routing';
import { transformDetailImageUrl } from '@/lib/ct/image-config';

/** Image and brand story (server). All text, the image and the link come from `content/home.ts`. */
export default function EditorialStrip({ locale }: { locale: string }) {
  const content = HOME_CONTENT.editorial;
  const lines = headlineLines(pick(content.headline, locale));
  return (
    <section aria-labelledby="home-editorial-title" className="bg-canvas-2 home-section">
      <div className="wrap grid items-center gap-10 stack:grid-cols-2">
        <div className="relative aspect-[5/4] overflow-hidden rounded-hero bg-line">
          {content.imageUrl ? (
            <Image
              src={transformDetailImageUrl(content.imageUrl)}
              alt={pick(content.imageAlt, locale)}
              fill
              sizes="(min-width: 901px) 50vw, 100vw"
              className="object-cover"
            />
          ) : null}
        </div>
        <div>
          <p className="eyebrow m-0 mb-3 !text-ink-2">{pick(content.eyebrow, locale)}</p>
          <h2 id="home-editorial-title" className="m-0 font-display text-[36px] font-bold leading-[1.1] tracking-[-0.02em] text-ink max-mobile:text-[27px]">
            {lines.map((line, i) => (
              <Fragment key={line}>
                {i > 0 ? <br /> : null}
                {line}
              </Fragment>
            ))}
          </h2>
          <p className="mb-0 mt-4 max-w-[440px] text-[16px] leading-relaxed text-ink-2">{pick(content.body, locale)}</p>
          <div className="mt-7">
            <Link href={content.href} className={buttonClasses({ variant: 'ink' })}>
              {pick(content.cta, locale)}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
