import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PaymentMethodList } from '@/components/account/PaymentMethodList';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { requireCustomerPage } from '@/lib/auth/guard';
import { isLocale } from '@/lib/config/markets';
import { listPaymentMethods } from '@/lib/ct/payment-methods';
import { mapPaymentMethod } from '@/lib/mappers/paymentMethod';
import type { PaymentMethodView } from '@/lib/types';

// Session-specific: read on every request, never cached, never indexed.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.paymentMethods' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function PaymentMethodsPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const { customer } = await requireCustomerPage(locale, '/account/payment-methods');
  const t = await getTranslations({ locale, namespace: 'account' });

  // A missing scope on the storefront client (OA-02) or a failed read shows "unavailable", never an empty list.
  let methods: PaymentMethodView[] | null = null;
  try {
    methods = (await listPaymentMethods(customer.id)).map((pm) => mapPaymentMethod(pm, locale));
  } catch (error) {
    console.error('[account] payment methods unavailable', error instanceof Error ? error.name : 'unknown');
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: t('home'), href: '/' }, { label: t('title'), href: '/account' }, { label: t('paymentMethods.title') }]} />
        <h1 className="m-0 font-display text-4xl font-bold tracking-ui">{t('paymentMethods.title')}</h1>
        <p className="m-0 text-md text-text-muted">{t('paymentMethods.intro')}</p>
      </header>
      {methods === null ? (
        <p role="status" className="m-0 rounded-xl border border-border bg-neutral-50 p-5 text-md text-text-muted">
          {t('paymentMethods.unavailable')}
        </p>
      ) : (
        <PaymentMethodList initial={methods} />
      )}
    </div>
  );
}
