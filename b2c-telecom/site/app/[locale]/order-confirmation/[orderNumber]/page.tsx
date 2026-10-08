import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrderConfirmation } from '@/components/checkout/OrderConfirmation';
import { PlacementPending } from '@/components/checkout/PlacementPending';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { redirect } from '@/i18n/routing';
import { isOrderNumber } from '@/lib/checkout/orderNumber';
import { RETURN_SEGMENT } from '@/lib/config/checkout';
import { isLocale } from '@/lib/config/markets';
import { getOrderForConfirmation, resolveReturnTarget } from '@/lib/ct/checkout';
import { getSession } from '@/lib/ct/session';

// One buyer's order: read on every request from the stored order, never cached, never indexed (headers in next.config.ts).
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; orderNumber: string }>; searchParams: Promise<{ orderNumber?: string | string[]; orderId?: string | string[] }> };

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'confirmation' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function OrderConfirmationPage({ params, searchParams }: Props) {
  const { locale, orderNumber: rawNumber } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const orderNumber = decode(rawNumber);

  // The hosted Checkout returns to ONE fixed URL per connector (`paymentReturnUrl`, no locale in it): resolve the order and go to its page.
  if (orderNumber === RETURN_SEGMENT) {
    const query = await searchParams;
    const target = await resolveReturnTarget({ ...(first(query.orderNumber) ? { orderNumber: first(query.orderNumber) as string } : {}), ...(first(query.orderId) ? { orderId: first(query.orderId) as string } : {}) });
    if (!target) notFound();
    return redirect({ href: `/order-confirmation/${target}`, locale });
  }
  if (!isOrderNumber(orderNumber)) notFound();

  const [t, session] = await Promise.all([getTranslations('confirmation'), getSession()]);
  const view = await getOrderForConfirmation(session, orderNumber);
  // Not found: when this browser is waiting for exactly this number, the outcome is unknown (not a 404); anything else is not found.
  if (!view && session.pendingOrderNumber !== orderNumber) notFound();

  return (
    <>
      <section className="bg-brand-100 py-10 md:py-12">
        <div className="mx-auto w-full max-w-(--container-width) px-5 md:px-10">
          <div data-print="hide">
            <Breadcrumb items={[{ label: t('home'), href: '/' }, { label: t('title') }]} />
          </div>
          <h1 className="mb-2 mt-3 font-display text-5xl font-bold tracking-ui">{t('title')}</h1>
        </div>
      </section>
      <section aria-label={t('title')} className="mx-auto w-full max-w-(--container-width) px-5 pb-16 pt-8 md:px-10">
        {view ? <OrderConfirmation view={view} now={new Date()} /> : <PlacementPending orderNumber={orderNumber} />}
      </section>
    </>
  );
}
