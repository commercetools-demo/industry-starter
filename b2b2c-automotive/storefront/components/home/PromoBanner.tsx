// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// A reseller promo band. Title and text are plain text (React escapes them; never HTML). The copy does not create a discount:
// the cart discount itself is configured in the portal and applied in the cart.
import { BlockLink } from '@/components/home/BlockLink';
import { useHomeData } from '@/components/home/HomeDataContext';
import { fillTemplate } from '@/lib/home/template';
import { parseBlockProps, type PromoTone } from '@/lib/puck/automotive-blocks.schema';

export const TONE_CLASSES: Record<PromoTone, { box: string; title: string; text: string }> = {
  brand: { box: 'bg-surface-brand-subtle', title: 'text-text-link', text: 'text-text-body' },
  accent: { box: 'bg-accent-50', title: 'text-accent-800', text: 'text-accent-800' },
  neutral: { box: 'bg-surface-quiet', title: 'text-text-strong', text: 'text-text-body' },
};

export function PromoBanner(raw: Record<string, unknown>) {
  const data = useHomeData();
  const props = parseBlockProps('PromoBanner', raw);
  const values = { reseller: data.storeName, city: data.branch?.city };
  const title = fillTemplate(props.title, values);
  const text = fillTemplate(props.text, values);
  if (!title && !text) return null;
  const tone = TONE_CLASSES[props.tone];

  return (
    <section className="mx-auto w-full max-w-content px-5 py-5">
      <div className={`flex flex-wrap items-center justify-between gap-4 rounded-md p-5 ${tone.box}`}>
        <div className="grid gap-1">
          {title ? <h2 className={`font-display text-xl font-semibold ${tone.title}`}>{title}</h2> : null}
          {text ? <p className={`font-body text-md leading-normal ${tone.text}`}>{text}</p> : null}
        </div>
        {props.ctaLabel && props.ctaHref ? (
          <BlockLink
            href={props.ctaHref}
            store={data.storeKey}
            className="inline-flex min-h-7 items-center justify-center rounded-sm bg-action px-5 font-display text-sm font-medium text-text-on-brand hover:bg-action-hover active:bg-action-active"
          >
            {props.ctaLabel}
          </BlockLink>
        ) : null}
      </div>
    </section>
  );
}
