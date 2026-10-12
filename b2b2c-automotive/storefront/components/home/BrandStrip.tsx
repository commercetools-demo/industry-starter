// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// A row of brand logos (alt text is the brand name); a brand without a logo shows its name. Empty by default: renders nothing
// without brands. Logo URLs are the reseller's own (CSP img-src applies, see lib/csp.ts and CSP_IMG_HOSTS).
import { useHomeData } from '@/components/home/HomeDataContext';
import { BlockLink } from '@/components/home/BlockLink';
import { parseBlockProps } from '@/lib/puck/automotive-blocks.schema';

export function BrandStrip(raw: Record<string, unknown>) {
  const data = useHomeData();
  const props = parseBlockProps('BrandStrip', raw);
  if (props.brands.length === 0) return null;

  return (
    <section aria-label={props.title || undefined} className="mx-auto w-full max-w-content px-5 py-5">
      {props.title ? <h2 className="mb-4 font-display text-xl font-semibold text-text-strong">{props.title}</h2> : null}
      <ul className="flex flex-wrap items-center gap-5">
        {props.brands.map((brand, index) => {
          const content = brand.logoUrl ? (
            // A plain img: logos come from arbitrary reseller hosts, which next/image would need to allow-list.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.name} loading="lazy" className="h-7 w-auto max-w-full object-contain" />
          ) : (
            <span className="font-display text-md font-semibold text-text-muted">{brand.name}</span>
          );
          return (
            <li key={`${brand.name}-${index}`}>
              {brand.href ? (
                <BlockLink href={brand.href} store={data.storeKey} className="inline-flex items-center rounded-sm">
                  {content}
                </BlockLink>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
