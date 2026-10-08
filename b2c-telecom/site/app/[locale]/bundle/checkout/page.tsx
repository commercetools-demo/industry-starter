import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckoutWizard } from '@/components/checkout/CheckoutWizard';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { redirect } from '@/i18n/routing';
import { resolveStep } from '@/lib/checkout/steps';
import { isLocale, marketFromLocale } from '@/lib/config/markets';
import { findCheckoutState } from '@/lib/ct/checkout';
import { getSession } from '@/lib/ct/session';

// Per-visitor state read on every request: never cached, never indexed (headers in next.config.ts).
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ step?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const [t, session, query] = await Promise.all([getTranslations('checkout'), getSession(), searchParams]);

  // An unreadable cart must not show a half page: the buyer goes back to the bundle, which has its own error handling.
  let state = null;
  try {
    state = await findCheckoutState(session, marketFromLocale(locale));
  } catch (error) {
    console.error('[checkout] cart unavailable', error instanceof Error ? error.name : 'unknown');
  }
  if (!state || state.cart.lines.length === 0) return redirect({ href: '/bundle', locale });

  const requested = Array.isArray(query.step) ? query.step[0] : query.step;
  const step = resolveStep(requested, state);
  // A later step whose predecessors are incomplete, and the payment step (never a landing step), redirect to where the buyer can go.
  if (requested !== undefined && requested !== step) return redirect({ href: `/bundle/checkout?step=${step}`, locale });

  return (
    <>
      <section className="bg-brand-100 py-10 md:py-12">
        <div className="mx-auto w-full max-w-(--container-width) px-5 md:px-10">
          <Breadcrumb items={[{ label: t('home'), href: '/' }, { label: t('bundle'), href: '/bundle' }, { label: t('title') }]} />
          <h1 className="mb-2 mt-3 font-display text-5xl font-bold tracking-ui">{t('title')}</h1>
        </div>
      </section>
      <section aria-label={t('title')} className="mx-auto w-full max-w-(--container-width) px-5 pb-16 pt-8 md:px-10">
        <CheckoutWizard initial={state} step={step} />
      </section>
    </>
  );
}
