'use client';

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import type { UISlotStatus } from '../protocol';
import {
  SHOWCASE_COMPONENTS,
  SHOWCASE_LOCALES,
  type ShowcaseComponent,
  type ShowcaseLocale,
  checkoutPayload,
  fixtureFor,
  productsPayload,
} from '../fixtures';
import AssistantBlock from './index';

const STATES: readonly UISlotStatus[] = ['final', 'partial', 'retrying'];
const FRAMES = [480, 360] as const;

/** A stand-in for the provider's add: it confirms at once, so the button phases can be seen. Nothing is written anywhere. */
const confirmAdd = async (): Promise<boolean> => true;

function Frame({ width, label, children }: { width: number; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 font-mono text-xs text-(--ink-3)">{label}</p>
      <div
        className="assistant-scope rounded-xl border border-dashed border-(--line-2) bg-(--ground) p-3"
        style={{ width }}
        data-frame={width}
      >
        {children}
      </div>
    </div>
  );
}

/** Every card in every slot state, in a 480 px dock and a 360 px sheet, once per market (currency formatting follows the locale). */
export default function Showcase({ messages }: { messages: Record<ShowcaseLocale, AbstractIntlMessages> }) {
  return (
    <div className="space-y-10 p-6">
      <p className="eyebrow">Assistant card showcase (fixture data, nothing is sent)</p>
      {SHOWCASE_LOCALES.map((locale) => (
        <NextIntlClientProvider key={locale} locale={locale} messages={messages[locale]}>
          <section className="space-y-8" data-locale={locale} aria-label={locale}>
            <h2 className="text-lg font-semibold">{locale}</h2>
            {SHOWCASE_COMPONENTS.map((component) => (
              <Card key={component} component={component} locale={locale} />
            ))}
            <div data-component="products-variants" className="space-y-3">
              <h3 className="font-mono text-sm">products: grid and list layouts</h3>
              <div className="flex flex-wrap items-start gap-6">
                {(['grid', 'list'] as const).map((layout) => (
                  <Frame key={layout} width={480} label={layout}>
                    <AssistantBlock
                      block={{ component: 'products', payload: productsPayload(locale, layout) }}
                      status="final"
                      onAdd={confirmAdd}
                    />
                  </Frame>
                ))}
              </div>
            </div>
            <div data-component="checkout-variants" className="space-y-3">
              <h3 className="font-mono text-sm">checkout: no discount</h3>
              <div className="flex flex-wrap items-start gap-6">
                <Frame width={480} label="no discount">
                  <AssistantBlock block={{ component: 'checkout', payload: checkoutPayload(locale, { discount: false }) }} status="final" />
                </Frame>
              </div>
            </div>
          </section>
        </NextIntlClientProvider>
      ))}
    </div>
  );
}

function Card({ component, locale }: { component: ShowcaseComponent; locale: ShowcaseLocale }) {
  const payload = fixtureFor(component, locale);
  const silentWhilePartial = component === 'order_status' || component === 'checkout';
  return (
    <div data-component={component} className="space-y-3">
      <h3 className="font-mono text-sm">{component}</h3>
      {STATES.map((state) => (
        <div key={state} data-state={state} className="space-y-1">
          <p className="text-xs text-(--ink-3)">
            {state}
            {state !== 'final' && silentWhilePartial ? ' (renders nothing until final)' : ''}
          </p>
          <div className="flex flex-wrap items-start gap-6">
            {FRAMES.map((width) => (
              <Frame key={width} width={width} label={`${width}px`}>
                <AssistantBlock block={{ component, payload }} status={state} onAdd={confirmAdd} />
              </Frame>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
