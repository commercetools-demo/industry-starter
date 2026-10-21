'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCartUi } from '@/components/cart/use-cart-ui';
import PolicyLink from '@/components/content/PolicyLink';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Icon from '@/components/ui/Icon';
import { ApiError } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { useCheckout, type HostedSession } from '@/hooks/useCheckout';
import { Link, useRouter } from '@/i18n/routing';
import { subscribeNeedsAccount } from '@/lib/checkout/guards';
import { blockingIssues } from '@/lib/checkout/summary';
import { validatePickupName } from '@/lib/checkout/validate';
import { registerHref, signInHref } from '@/lib/routes';
import type { CheckoutPayment, CheckoutState } from '@/lib/types';
import CheckoutIssues from './CheckoutIssues';
import DeliveryNote from './DeliveryNote';
import FulfilmentCluster from './FulfilmentCluster';
import HostedCheckout, { type HostedFailure } from './HostedCheckout';
import OrderSummary from './OrderSummary';
import PickupLocationCard, { type PickupPersonChoice } from './PickupLocationCard';
import StepIndicator from './StepIndicator';

type Banner = null | 'declined' | 'generic' | 'unavailable' | 'placement' | 'totals' | 'signIn' | 'firstDone';

/**
 * `/[locale]/checkout`: two stages. Review is ours (the bag by fulfilment cluster, the pickup person, the summary); Pay is the
 * complete hosted Checkout (D-039), which owns address, delivery method and payment. Totals are always the engine's, read back
 * from the last response. A mixed bag is paid per `state.payments` (complete-per-group: collect first, then delivery).
 * `resumePart` continues a mixed purchase after a redirect payment returned to the page.
 */
export default function CheckoutPage({ resumePart }: { resumePart?: number }) {
  const t = useTranslations('checkout');
  const router = useRouter();
  const { customer } = useAccount();
  const ui = useCartUi();
  const { state, error, isLoading, reload, savePickup, createSession, complete } = useCheckout(resumePart === undefined ? {} : { resume: true });

  const [stage, setStage] = useState<1 | 2>(1);
  const [person, setPerson] = useState<PickupPersonChoice>('me');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [hosted, setHosted] = useState<{ session: HostedSession; part: number; payments: CheckoutPayment[] } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const payHeading = useRef<HTMLHeadingElement>(null);
  const resumed = useRef(false);

  const memberName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') : '';
  const prefilled = useRef(false);
  useEffect(() => {
    if (!prefilled.current && memberName) {
      prefilled.current = true;
      setName((n) => n || memberName);
    }
  }, [memberName]);

  const choosePerson = (p: PickupPersonChoice) => {
    setPerson(p);
    setName(p === 'me' ? memberName : '');
    setNameError(undefined);
  };

  const validateName = useCallback((): string | undefined => {
    const code = validatePickupName(name, true);
    return code ? t(`errors.${code}`) : undefined;
  }, [name, t]);

  const goToReview = useCallback(() => {
    setStage(1);
    setHosted(null);
    void reload();
    requestAnimationFrame(() => reviewHeading.current?.focus());
  }, [reload]);

  /** Creates the session for payment `part` and shows the hosted flow. */
  const beginPayment = useCallback(
    async (part: number, payments: CheckoutPayment[]) => {
      const payment = payments[part];
      if (!payment) return goToReview();
      const session = await createSession(payment.totalCents, part);
      setHosted({ session, part, payments });
      setStage(2);
      requestAnimationFrame(() => payHeading.current?.focus());
    },
    [createSession, goToReview],
  );

  const fail = useCallback(
    (e: unknown) => {
      if (!(e instanceof ApiError)) return setBanner('generic');
      const fields = e.extra.fields as Record<string, string> | undefined;
      if (e.code === 'validation_failed' && fields?.pickupName) {
        setNameError(t(`errors.${fields.pickupName as 'pickup_name_required'}`));
        requestAnimationFrame(() => nameRef.current?.focus());
        return;
      }
      if (e.code === 'sign_in_required') return setBanner('signIn');
      if (e.code === 'order_exists' && typeof e.extra.orderId === 'string') {
        router.replace(`/checkout/confirmation/${encodeURIComponent(e.extra.orderId)}`);
        return;
      }
      if (e.code === 'totals_changed') {
        setBanner('totals');
        goToReview();
        return;
      }
      if (['collect_out_of_stock', 'collect_not_available', 'checkout_blocked', 'checkout_not_ready', 'cart_empty'].includes(e.code)) {
        void reload();
        return;
      }
      setBanner(e.code === 'upstream_unavailable' ? 'unavailable' : 'generic');
    },
    [goToReview, reload, router, t],
  );

  const onContinue = async () => {
    if (!state || busy) return;
    setBanner(null);
    const collect = Boolean(state.pickup);
    if (collect) {
      const message = validateName();
      setNameError(message);
      if (message) {
        nameRef.current?.focus();
        return;
      }
    }
    setBusy(true);
    try {
      const next = await savePickup(collect ? { person, pickupName: name.trim() } : {});
      await beginPayment(0, next.payments ?? []);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const onCompleted = useCallback(async () => {
    if (!hosted) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await complete(hosted.part);
      if (res.next === null) {
        router.replace(`/checkout/confirmation/${encodeURIComponent(res.orderId)}`);
        return;
      }
      setBanner('firstDone');
      await beginPayment(res.next, hosted.payments);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'order_not_found') setBanner('placement');
      else fail(e);
    } finally {
      setBusy(false);
    }
  }, [beginPayment, complete, fail, hosted, router]);

  const onFailure = useCallback((kind: HostedFailure) => setBanner(kind), []);
  const onUnavailable = useCallback(() => setBanner('unavailable'), []);

  // After a redirect payment of one part of a mixed purchase: go on with the next payment.
  useEffect(() => {
    if (resumePart === undefined || resumed.current || !state?.payments) return;
    resumed.current = true;
    setBusy(true);
    beginPayment(resumePart, state.payments)
      .catch(fail)
      .finally(() => setBusy(false));
  }, [resumePart, state, beginPayment, fail]);

  const steps: { id: 1 | 2; label: string }[] = [
    { id: 1, label: t('steps.review') },
    { id: 2, label: t('steps.pay') },
  ];

  const header = (
    <div className="mb-8 mt-6 flex flex-wrap items-center justify-between gap-4">
      <h1 className="m-0 font-display text-[30px] font-extrabold tracking-[-0.02em]">{t('title')}</h1>
      <StepIndicator steps={steps} current={stage} onGoTo={(id) => id === 1 && goToReview()} />
    </div>
  );

  if (isLoading) {
    return (
      <div className="wrap pb-20">
        {header}
        <div role="status" aria-label={t('payment.loading')} className="grid gap-12 stack:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
          <div className="h-72 animate-pulse rounded-card bg-canvas-2" />
          <div className="h-72 animate-pulse rounded-card bg-canvas-2" />
        </div>
      </div>
    );
  }
  if (!state) {
    const empty = error instanceof ApiError && (error.code === 'cart_not_found' || error.code === 'cart_empty');
    return (
      <div className="wrap pb-20">
        {header}
        {empty ? (
          <div className="flex flex-col items-center gap-4 px-5 py-20 text-center" data-testid="checkout-empty">
            <Icon name="bag" size={44} />
            <h2 className="m-0 font-display text-[20px] font-semibold">{t('empty.title')}</h2>
            <ButtonLink href="/shop" size="lg">
              {t('empty.cta')}
            </ButtonLink>
          </div>
        ) : (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="m-0">{t('loadFailed')}</p>
            <Button variant="ghost" onClick={() => void reload()}>
              {t('retry')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wrap pb-20">
      {header}
      <div className="grid items-start gap-12 stack:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
        <div className="min-w-0">
          {stage === 1 ? (
            <Review
              state={state}
              person={person}
              name={name}
              nameError={nameError}
              busy={busy}
              banner={banner}
              needsAccount={customer === null && subscribeNeedsAccount(state.cart, {})}
              nameRef={nameRef}
              headingRef={reviewHeading}
              onPerson={choosePerson}
              onName={(v) => {
                setName(v);
                if (nameError) setNameError(undefined);
              }}
              onBlurName={() => setNameError(validateName())}
              onChangeStore={ui.openStoreChange}
              onContinue={() => void onContinue()}
            />
          ) : (
            <Pay
              hosted={hosted}
              banner={banner}
              busy={busy}
              headingRef={payHeading}
              onBack={goToReview}
              onCompleted={() => void onCompleted()}
              onFailure={onFailure}
              onUnavailable={onUnavailable}
            />
          )}
        </div>
        <OrderSummary state={state} />
      </div>
    </div>
  );
}

function BannerMessage({ banner }: { banner: Banner }) {
  const t = useTranslations('checkout');
  if (!banner) return null;
  const text: Record<Exclude<Banner, null>, string> = {
    declined: t('payment.declined'),
    generic: t('payment.generic'),
    unavailable: t('payment.unavailable'),
    placement: t('placement.retry'),
    totals: t('totalsChanged'),
    signIn: t('signIn.required'),
    firstDone: t('payment.firstDone'),
  };
  return (
    <div role={banner === 'firstDone' ? 'status' : 'alert'} data-testid="checkout-banner" data-banner={banner} className="mb-4 rounded-card border border-line-2 bg-canvas-2 p-4 text-[14px] text-ink">
      {text[banner]}
      {banner === 'signIn' ? (
        <Link href={signInHref('/checkout')} className="ml-2 font-medium underline underline-offset-2">
          {t('signIn.cta')}
        </Link>
      ) : null}
    </div>
  );
}

/** Workstream N: a subscription is managed in the account, so a guest signs in or registers before paying. */
function SubscriptionNeedsAccount() {
  const t = useTranslations('subscription.checkout');
  return (
    <div role="status" data-testid="subscription-needs-account" className="mb-4 rounded-card border border-line-2 bg-canvas-2 p-4 text-[14px] text-ink">
      <p className="m-0 mb-3">{t('needsAccount')}</p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={signInHref('/checkout')} variant="ink">
          {t('signIn')}
        </ButtonLink>
        <ButtonLink href={registerHref('/checkout')} variant="ghost">
          {t('register')}
        </ButtonLink>
      </div>
    </div>
  );
}

function Review({
  state, person, name, nameError, busy, banner, needsAccount, nameRef, headingRef, onPerson, onName, onBlurName, onChangeStore, onContinue,
}: {
  state: CheckoutState;
  person: PickupPersonChoice;
  name: string;
  nameError: string | undefined;
  busy: boolean;
  banner: Banner;
  /** A guest with a subscribe line (workstream N): payment waits for an account. */
  needsAccount: boolean;
  nameRef: React.RefObject<HTMLInputElement | null>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onPerson: (p: PickupPersonChoice) => void;
  onName: (v: string) => void;
  onBlurName: () => void;
  onChangeStore: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations('checkout');
  const blocked = blockingIssues(state.issues).length > 0;
  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        {t('steps.review')}
      </h2>
      <BannerMessage banner={banner} />
      {needsAccount ? <SubscriptionNeedsAccount /> : null}
      <CheckoutIssues issues={state.issues} cart={state.cart} />
      {state.cart.groups.map((group) => (
        <FulfilmentCluster key={group.key} cart={state.cart} group={group}>
          {group.kind === 'collect' && state.pickup ? (
            <PickupLocationCard
              pickup={state.pickup}
              person={person}
              name={name}
              {...(nameError ? { error: nameError } : {})}
              nameRef={nameRef}
              onPerson={onPerson}
              onName={onName}
              onBlurName={onBlurName}
              onChangeStore={onChangeStore}
            />
          ) : null}
          {group.kind === 'delivery' && state.deliveryNote ? <DeliveryNote note={state.deliveryNote} currency={state.summary.currency} /> : null}
        </FulfilmentCluster>
      ))}
      <Button size="lg" block loading={busy} disabled={blocked || busy || needsAccount} onClick={onContinue} className="mt-5">
        {busy ? t('continuing') : t('continue')}
      </Button>
    </div>
  );
}

function Pay({
  hosted, banner, busy, headingRef, onBack, onCompleted, onFailure, onUnavailable,
}: {
  hosted: { session: HostedSession; part: number; payments: CheckoutPayment[] } | null;
  banner: Banner;
  busy: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onCompleted: () => void;
  onFailure: (kind: HostedFailure) => void;
  onUnavailable: () => void;
}) {
  const t = useTranslations('checkout');
  const payment = hosted?.payments[hosted.part];
  const total = hosted?.payments.length ?? 1;
  const cluster = payment
    ? payment.clusterKey.startsWith('collect:')
      ? t('cluster.collect', { store: payment.label ?? '' })
      : payment.clusterKey === 'delivery'
        ? t('cluster.delivery')
        : t('cluster.subscribe')
    : '';
  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="mb-1 mt-0 font-display text-[20px] font-semibold">
        {t('steps.pay')}
      </h2>
      {total > 1 && hosted ? (
        <p data-testid="payment-part" className="m-0 mb-3 text-[14px] font-medium text-ink-2">
          {t('payment.partOf', { n: hosted.part + 1, total, cluster })}
        </p>
      ) : null}
      <p className="m-0 mb-4 flex items-center gap-2 text-[13px] text-ink-3">
        <Icon name="lock" size={14} />
        {t('payment.secure')}
      </p>
      <BannerMessage banner={banner} />
      {banner === 'placement' ? (
        <Button variant="ghost" onClick={onBack}>
          {t('placement.retryButton')}
        </Button>
      ) : hosted ? (
        <HostedCheckout key={hosted.session.sessionId} session={hosted.session} onCompleted={onCompleted} onFailure={onFailure} onUnavailable={onUnavailable} />
      ) : null}
      {busy ? (
        <p role="status" className="m-0 mt-3 text-[13px] text-ink-3">
          {t('payment.placing')}
        </p>
      ) : null}
      <p className="m-0 mt-4 text-[12.5px] text-ink-3">
        {t('payment.consentIntro')} <PolicyLink slug="terms">{t('payment.consentTerms')}</PolicyLink> {t('payment.consentJoin')}{' '}
        <PolicyLink slug="privacy">{t('payment.consentPrivacy')}</PolicyLink>.
      </p>
      <div className="mt-4">
        <Button variant="ghost" onClick={onBack}>
          {t('backToReview')}
        </Button>
      </div>
    </div>
  );
}
