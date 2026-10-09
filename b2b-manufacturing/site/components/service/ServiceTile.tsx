import { sizedImage, srcSetFor } from '@/lib/utils';
import { Link } from '@/i18n/routing';

/**
 * Service card for listings and related services. The whole card is clickable through one stretched link on the heading, so the link's
 * accessible name is exactly the visible service name (WCAG 2.5.3); the summary stays readable text and the index and "Learn more" are decorative.
 */
export function ServiceTile({ href, index, name, summary, imageUrl, more, eager }: { href: string; id?: string; index?: number; eager?: boolean; name: string; summary: string; imageUrl?: string; more: string }) {
  return (
    <article className="card tile">
      {imageUrl ? (
        // The image is decorative (the name follows); plain img because the optimizer is off.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sizedImage(imageUrl, 800)} srcSet={srcSetFor(imageUrl, [400, 800])} sizes="(max-width: 900px) 100vw, 400px" alt="" loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
      ) : <div className="ph" aria-hidden="true" />}
      <div className="b">
        {index ? <span className="num" aria-hidden="true">{String(index).padStart(2, '0')}</span> : null}
        <h3><Link className="stretched" href={href}>{name}</Link></h3>
        <p>{summary}</p>
        <span className="more" aria-hidden="true">{more}</span>
      </div>
    </article>
  );
}
