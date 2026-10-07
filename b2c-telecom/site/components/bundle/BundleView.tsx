'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { SWRConfig } from 'swr';
import { AcquisitionLine } from '@/components/devices/AcquisitionLine';
import { AcquisitionTotals } from '@/components/devices/AcquisitionTotals';
import { useToast } from '@/components/ui/Toast';
import { CartError, useCart, useCartMutations } from '@/hooks/useCart';
import { Link } from '@/i18n/routing';
import { KEY_CART } from '@/lib/cache-keys';
import type { BlockedAdd, Cart } from '@/lib/types';
import { AddonRow } from './AddonRow';
import { DiscountCodeForm } from './DiscountCodeForm';
import { DiscountPrompts } from './DiscountPrompts';
import { EmptyBundle, type EmptyBundleLink } from './EmptyBundle';
import { IssuesBanner } from './IssuesBanner';
import { BlockedAddNotice } from './BlockedAddNotice';
import { OrderSummary } from './OrderSummary';
import { PlanCard } from './PlanCard';
import { OrderedBannerSlot, SaveBundleSlot } from './slots';

type BundleViewProps = {
  /** The cart as the server read it for this request: the SWR fallback, so the page never flashes the empty state. */
  initialCart: Cart | null;
  signedIn: boolean;
  /** Category links of the empty state (from the category tree, in the buyer's locale). */
  links: EmptyBundleLink[];
};

const ADDON_KINDS = new Set(['addon', 'equipment', 'device']);

function BundleContent({ signedIn, links }: Omit<BundleViewProps, 'initialCart'>): ReactElement {
  const t = useTranslations('bundle');
  const tDevices = useTranslations('devices');
  const toast = useToast();
  const { cart } = useCart();
  const mutations = useCartMutations();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ blocked: BlockedAdd; name: string } | null>(null);

  async function run(action: () => Promise<unknown>, name = ''): Promise<void> {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      const blocked = error instanceof CartError ? error.blocked : undefined;
      if (blocked) setNotice({ blocked, name });
      else toast.show({ message: t('error.generic'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const lines = cart?.lines ?? [];
  const plans = lines.filter((line) => line.kind === 'plan');
  // Devices with a recorded acquisition mode have their own section (workstream Q); any other device line stays a plain row.
  const devices = lines.filter((line) => line.kind === 'device' && line.acquisition !== undefined);
  const addons = lines.filter((line) => ADDON_KINDS.has(line.kind) && !devices.includes(line));
  if (!cart || plans.length + addons.length + devices.length === 0) return <EmptyBundle links={links} />;

  const removeLine = (lineId: string, cascade = false): Promise<void> => run(() => mutations.removeLine(lineId, { cascade }));

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <OrderedBannerSlot />
        <IssuesBanner issues={cart.issues} lines={lines} busy={busy} onRemove={(lineId) => void removeLine(lineId, true)} />
        {notice ? <BlockedAddNotice blocked={notice.blocked} name={notice.name} onDismiss={() => setNotice(null)} /> : null}
        {plans.length > 0 ? <h2 className="m-0 font-display text-3xl font-bold tracking-ui">{t('section.plans')}</h2> : null}
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            line={plan}
            dependents={addons.filter((addon) => addon.parentLineId === plan.id)}
            busy={busy}
            onQuantity={(lineId, quantity) => void run(() => mutations.setQuantity(lineId, quantity), plan.name)}
            onRemove={(lineId, cascade) => void removeLine(lineId, cascade)}
          />
        ))}
        <h2 className="m-0 mt-2 font-display text-3xl font-bold tracking-ui">{t('section.addons')}</h2>
        {addons.length === 0 ? (
          <p className="m-0 text-md text-text-muted">
            {t('addons.empty')}{' '}
            <Link href="/shop/add-ons" className="text-text underline underline-offset-4">
              {t('addons.browse')}
            </Link>
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {addons.map((addon) => (
              <AddonRow key={addon.id} line={addon} planName={plans.find((plan) => plan.id === addon.parentLineId)?.name} busy={busy} onRemove={(lineId) => void removeLine(lineId)} />
            ))}
          </ul>
        )}
        {devices.length > 0 ? (
          <>
            <h2 className="m-0 mt-2 font-display text-3xl font-bold tracking-ui">{tDevices('section')}</h2>
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {devices.map((device) => (
                <AcquisitionLine key={device.id} line={device} busy={busy} onRemove={(lineId) => void removeLine(lineId)} />
              ))}
            </ul>
            <AcquisitionTotals lines={devices} />
          </>
        ) : null}
        <DiscountPrompts cart={cart} onAdd={(args, name) => run(() => mutations.addLine(args), name)} busy={busy} />
      </div>
      <OrderSummary
        cart={cart}
        signedIn={signedIn}
        codeForm={<DiscountCodeForm codes={cart.discountCodes} onApply={mutations.applyCode} onRemove={mutations.removeCode} />}
        extra={<SaveBundleSlot />}
      />
    </div>
  );
}

export function BundleView({ initialCart, signedIn, links }: BundleViewProps): ReactElement {
  return (
    <SWRConfig value={{ fallback: { [KEY_CART]: initialCart } }}>
      <BundleContent signedIn={signedIn} links={links} />
    </SWRConfig>
  );
}
