import Image from 'next/image';
import { PBText } from '@commercetools-labs/page-builder';
import AuthoredLink from '@/components/page-builder/blocks/AuthoredLink';
import { transformDetailImageUrl } from '@/lib/ct/image-config';
import { authoredImage } from '@/lib/page-builder/authored';

/**
 * Content components of the page builder catalog (`content/*`). Settings are the author's, already localized by the service.
 * Rich text goes through the shim's `PBText` with `html`, which sanitises it against an allowlist (no script, event handlers
 * or `javascript:` URLs) before it reaches the DOM; the repo's other content never takes author HTML (see plans/QUESTIONS.md).
 * Every optional field may be absent: the component renders without it.
 */

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

function Picture({ url, alt, sizes, className }: { url: string | undefined; alt: string; sizes: string; className?: string }) {
  if (!url) return null;
  return <Image src={transformDetailImageUrl(url)} alt={alt} fill sizes={sizes} className={className ?? 'object-cover'} />;
}

export function Hero({ data }: { data: { eyebrow?: string; title?: string; body?: string; image?: string; imageAlt?: string; buttons?: Array<{ label?: string; link?: string }> } }) {
  const image = authoredImage(data.image);
  const buttons = (data.buttons ?? []).filter((b) => text(b.label) !== '');
  return (
    <section className="home-section">
      <div className="wrap grid items-center gap-10 stack:grid-cols-2">
        <div>
          {data.eyebrow ? <PBText field="eyebrow" value={data.eyebrow} as="p" className="eyebrow m-0 mb-3" /> : null}
          {data.title ? <PBText field="title" value={data.title} as="h1" html className="hero-title m-0" /> : null}
          {data.body ? <PBText field="body" value={data.body} as="div" html className="mt-4 max-w-[520px] text-[17px] leading-relaxed text-ink-2" /> : null}
          {buttons.length ? (
            <div className="mt-7 flex flex-wrap gap-3">
              {buttons.map((b, i) => (
                <AuthoredLink key={i} href={b.link} variant={i === 0 ? 'ink' : 'ghost'}>
                  {b.label}
                </AuthoredLink>
              ))}
            </div>
          ) : null}
        </div>
        {image ? (
          <div className="relative aspect-[5/4] overflow-hidden rounded-hero bg-canvas-2 max-stack:hidden">
            <Picture url={image} alt={text(data.imageAlt)} sizes="(min-width: 901px) 50vw, 100vw" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function Banner({ data }: { data: { title?: string; text?: string; image?: string; imageAlt?: string; linkLabel?: string; link?: string } }) {
  const image = authoredImage(data.image);
  return (
    <section className="wrap">
      <div className="relative overflow-hidden rounded-card bg-canvas-2">
        {image ? (
          <div className="relative aspect-[16/5] max-mobile:aspect-[4/3]">
            <Picture url={image} alt={text(data.imageAlt)} sizes="100vw" />
          </div>
        ) : null}
        <div className="p-6 mobile:p-8">
          {data.title ? <PBText field="title" value={data.title} as="h2" className="section-title m-0" /> : null}
          {data.text ? <PBText field="text" value={data.text} as="p" className="mb-0 mt-2 max-w-[620px] text-[16px] text-ink-2" /> : null}
          {data.linkLabel ? (
            <div className="mt-5">
              <AuthoredLink href={data.link}>{data.linkLabel}</AuthoredLink>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function RichText({ data }: { data: { body?: string } }) {
  if (!data.body) return null;
  return (
    <section className="wrap">
      <PBText field="body" value={data.body} as="div" html className="max-w-[720px] text-[16px] leading-relaxed text-ink-2" />
    </section>
  );
}

export function ImageBlock({ data }: { data: { image?: string; imageAlt?: string; caption?: string } }) {
  const image = authoredImage(data.image);
  if (!image) return null;
  return (
    <figure className="wrap m-0">
      <div className="relative aspect-[16/9] overflow-hidden rounded-card bg-canvas-2">
        <Picture url={image} alt={text(data.imageAlt)} sizes="100vw" />
      </div>
      {data.caption ? <PBText field="caption" value={data.caption} as="figcaption" className="mt-2 text-[13px] text-ink-3" /> : null}
    </figure>
  );
}

export function Cta({ data }: { data: { title?: string; text?: string; label?: string; link?: string } }) {
  if (!data.label) return null;
  return (
    <section className="wrap">
      <div className="rounded-card bg-canvas-2 p-6 text-center mobile:p-10">
        {data.title ? <PBText field="title" value={data.title} as="h2" className="section-title m-0" /> : null}
        {data.text ? <PBText field="text" value={data.text} as="p" className="mx-auto mb-0 mt-2 max-w-[560px] text-[16px] text-ink-2" /> : null}
        <div className="mt-5">
          <AuthoredLink href={data.link}>{data.label}</AuthoredLink>
        </div>
      </div>
    </section>
  );
}
