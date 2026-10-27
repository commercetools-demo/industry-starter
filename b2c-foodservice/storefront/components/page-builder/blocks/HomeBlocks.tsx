import Image from 'next/image';
import { PBText, type CategoryNode, type ProductCard } from '@commercetools-labs/page-builder';
import AuthoredLink from '@/components/page-builder/blocks/AuthoredLink';
import ProductTile from '@/components/page-builder/blocks/ProductTile';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import { transformDetailImageUrl, transformListingImageUrl } from '@/lib/ct/image-config';
import { authoredImage, categoryHrefOf } from '@/lib/page-builder/authored';

/** Home components of the page builder catalog (`home/*`, `product/product-strip`). Optional fields may be absent. */

export function CategoryTiles({ data }: { data: { title?: string; categories?: CategoryNode[] | null } }) {
  const categories = (data.categories ?? []).filter((c) => c && c.slug && c.name);
  if (categories.length === 0) return null;
  return (
    <section className="home-section-tight">
      <div className="wrap">
        {data.title ? <PBText field="title" value={data.title} as="h2" className="section-title m-0 mb-5" /> : null}
        <ul className="m-0 grid list-none grid-cols-4 gap-5 p-0 max-[1080px]:grid-cols-2 max-mobile:gap-3.5">
          {categories.map((category) => {
            const image = authoredImage(category.image?.url);
            return (
              <li key={category.id} className="min-w-0">
                <Link href={categoryHrefOf(category.slug)} data-testid="pb-category-tile" className="group relative block aspect-[4/5] overflow-hidden rounded-card bg-ink-2 text-surface no-underline">
                  {image ? (
                    <Image src={transformListingImageUrl(image)} alt="" fill sizes="(min-width: 1081px) 25vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-surface/60">
                      <Icon name="bean" size={48} />
                    </span>
                  )}
                  <span aria-hidden="true" className="home-tile-shade absolute inset-0" />
                  <span className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-3 font-display text-[17px] font-semibold">
                    {category.name}
                    <Icon name="arrowR" size={18} className="shrink-0" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function EditorialStrip({ data }: { data: { eyebrow?: string; headline?: string; body?: string; image?: string; imageAlt?: string; ctaLabel?: string; link?: string } }) {
  const image = authoredImage(data.image);
  return (
    <section className="bg-canvas-2 home-section">
      <div className="wrap grid items-center gap-10 stack:grid-cols-2">
        {image ? (
          <div className="relative aspect-[5/4] overflow-hidden rounded-hero bg-line">
            <Image src={transformDetailImageUrl(image)} alt={data.imageAlt ?? ''} fill sizes="(min-width: 901px) 50vw, 100vw" className="object-cover" />
          </div>
        ) : null}
        <div className={image ? '' : 'stack:col-span-2'}>
          {data.eyebrow ? <PBText field="eyebrow" value={data.eyebrow} as="p" className="eyebrow m-0 mb-3 !text-ink-2" /> : null}
          {data.headline ? <PBText field="headline" value={data.headline} as="h2" className="m-0 font-display text-[36px] font-bold leading-[1.1] tracking-[-0.02em] text-ink max-mobile:text-[27px]" /> : null}
          {data.body ? <PBText field="body" value={data.body} as="div" html className="mb-0 mt-4 max-w-[440px] text-[16px] leading-relaxed text-ink-2" /> : null}
          {data.ctaLabel ? (
            <div className="mt-7">
              <AuthoredLink href={data.link}>{data.ctaLabel}</AuthoredLink>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function SubscribeStrip({ data }: { data: { title?: string; text?: string; label?: string; link?: string } }) {
  if (!data.title && !data.label) return null;
  return (
    <section className="home-section-tight">
      <div className="wrap">
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-card bg-ink p-6 text-surface mobile:p-8">
          <div className="max-w-[560px]">
            {data.title ? <PBText field="title" value={data.title} as="h2" className="section-title m-0 !text-surface" /> : null}
            {data.text ? <PBText field="text" value={data.text} as="p" className="mb-0 mt-2 text-[15px] text-surface/80" /> : null}
          </div>
          {data.label ? <AuthoredLink href={data.link} variant="accent">{data.label}</AuthoredLink> : null}
        </div>
      </div>
    </section>
  );
}

export function ProductStrip({ data }: { data: { title?: string; products?: ProductCard[] | null; showPrice?: boolean } }) {
  const products = data.products ?? [];
  if (products.length === 0) return null;
  return (
    <section className="home-section">
      <div className="wrap">
        {data.title ? <PBText field="title" value={data.title} as="h2" className="section-title m-0 mb-5" /> : null}
        <ul className="grid-products m-0 list-none p-0">
          {products.map((product, i) => (
            <li key={product.id} className="min-w-0">
              <ProductTile product={product} showPrice={data.showPrice ?? true} imagePriority={i < 2} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
