'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import InstoreBottomBar from '@/components/instore/InstoreBottomBar';
import { useScanner } from '@/components/instore/scan/scanner-context';
import Icon from '@/components/ui/Icon';
import { useCart } from '@/hooks/useCart';
import { useInstoreOrder } from '@/hooks/useInstoreOrder';
import { Link, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import { emailOk, nameOk, phoneOk, type InstoreOrderForm } from '@/lib/checkout/instore-form';
import type { Cart } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

type Who = 'name' | 'badge';
type Notify = 'email' | 'phone';

const inputClass = 'h-[54px] w-full rounded-field border-[1.5px] border-line-2 bg-surface px-3.5 text-[16px] text-ink outline-none focus:border-ink';

function Segment<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'transition-press min-h-12 flex-1 rounded-pill border-[1.5px] border-ink px-4 text-[15px] font-bold',
            value === o.id ? 'bg-ink text-canvas' : 'bg-transparent text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Step({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-ink text-[14px] font-bold text-canvas">{n}</span>
        <h2 className="m-0 font-display text-[19px] font-bold">{title}</h2>
      </div>
      <p className="m-0 text-[13px] text-ink-3">{hint}</p>
    </div>
  );
}

/**
 * The In-store checkout (D-062): the booth order is free, so there is no payment. The shopper says who the order is for (a name, or
 * a badge scan, which is a placeholder until a reader exists) and how to tell them it is ready (email or phone); the server turns
 * the bag into an order. The totals show "Free" with the real price struck through (display only: the order keeps its real prices).
 */
export default function InstoreCheckout({ initialCart }: { initialCart?: Cart | null }) {
  const t = useTranslations('instore.checkout');
  const tb = useTranslations('instore.bag');
  const locale = useLocale();
  const router = useRouter();
  const { open } = useScanner();
  const { cart, isLoading } = useCart(initialCart === undefined ? {} : { initialCart });
  const { place, busy } = useInstoreOrder();
  const [who, setWho] = useState<Who>('name');
  const [name, setName] = useState('');
  const [badge, setBadge] = useState(false);
  const [notify, setNotify] = useState<Notify>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [failed, setFailed] = useState(false);

  if (isLoading) return <div role="status" aria-label={tb('loading')} className="m-4 h-40 animate-pulse rounded-card bg-canvas-2" />;
  if (!cart || cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center" data-testid="instore-empty-bag">
        <h1 className="m-0 font-display text-[28px] font-bold">{tb('empty.title')}</h1>
        <Link href="/" className="rounded-pill bg-ink px-8 py-4 font-bold text-canvas no-underline">
          {tb('empty.browse')}
        </Link>
      </div>
    );
  }

  const fmt = (m: { centAmount: number; currencyCode: string }) => formatMoney(m.centAmount, m.currencyCode, locale);
  const whoOk = who === 'name' ? nameOk(name) : badge;
  const notifyOk = notify === 'email' ? emailOk(email) : phoneOk(phone);
  const ready = whoOk && notifyOk && cart.canCheckout;
  const hint = !whoOk ? (who === 'name' ? t('hint.name') : t('hint.badge')) : !notifyOk ? (notify === 'email' ? t('hint.email') : t('hint.phone')) : t('hint.blocked');

  const submit = async () => {
    setFailed(false);
    const form: InstoreOrderForm = {
      who: who === 'name' ? { mode: 'name', name } : { mode: 'badge' },
      notify: notify === 'email' ? { mode: 'email', email } : { mode: 'phone', phone },
    };
    try {
      const orderId = await place(form);
      router.push(`/checkout/confirmation/${orderId}`);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="flex flex-col gap-[18px] px-6 pb-6 pt-1" data-testid="instore-checkout">
      <Link href="/bag" className="flex min-h-11 items-center gap-1.5 self-start text-[15px] font-bold text-ink-2 no-underline">
        <Icon name="chevL" size={18} />
        {t('back')}
      </Link>
      <h1 className="m-0 font-display text-[40px] font-bold leading-[1.05]">{t('title')}</h1>

      <div className="flex items-center gap-3.5 rounded-card bg-[var(--instore-green-bg)] p-4" data-testid="free-banner">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-[var(--instore-green)] text-surface">
          <Icon name="check" size={22} />
        </span>
        <p className="m-0 text-[14px] leading-snug text-ink">
          <b className="font-display text-[17px]">{t('free.title')}</b>
          <br />
          {t('free.body')}
        </p>
      </div>

      <section aria-label={t('summary')} className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
        <h2 className="m-0 font-display text-[17px] font-bold">{tb('total', { count: cart.count })}</h2>
        {cart.lines.map((l) => (
          <div key={l.id} className="flex justify-between gap-3 text-[14px] leading-snug">
            <span>
              {l.quantity} × {l.name}
              {l.variantSummary ? <span className="text-ink-2"> ({l.variantSummary})</span> : null}
            </span>
            <s className="shrink-0 text-ink-3">{fmt(l.total)}</s>
          </div>
        ))}
        <div className="flex justify-between border-t-[1.5px] border-line pt-3 font-display text-[20px] font-bold">
          <span>{t('totalLabel')}</span>
          <span className="instore-free" data-testid="checkout-total">
            {t('freeWord')}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-label={t('who.title')}>
        <Step n={1} title={t('who.title')} hint={t('chooseOne')} />
        <Segment<Who>
          value={who}
          onChange={setWho}
          options={[
            { id: 'name', label: t('who.name') },
            { id: 'badge', label: t('who.badge') },
          ]}
        />
        {who === 'name' ? (
          <label className="flex flex-col gap-1.5 text-[14px] font-medium">
            {t('who.nameLabel')}
            <input className={inputClass} type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('who.namePlaceholder')} />
          </label>
        ) : badge ? (
          <div className="flex min-h-16 items-center gap-3 rounded-field bg-[var(--instore-green-bg)] px-3.5 py-2.5 text-[14px]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-[var(--instore-green)] text-surface">
              <Icon name="check" size={18} />
            </span>
            <b>{t('who.badgeDone')}</b>
          </div>
        ) : (
          // Placeholder: a real badge reader replaces this button; it only marks the badge as scanned for now.
          <button
            type="button"
            onClick={() => setBadge(true)}
            className="flex min-h-16 items-center justify-center gap-2.5 rounded-field border-[1.5px] border-dashed border-accent bg-[color:color-mix(in_srgb,var(--accent)_12%,var(--canvas))] text-[16px] font-bold text-accent-press"
          >
            <Icon name="barcode" size={22} />
            {t('who.badgeScan')}
          </button>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-label={t('notify.title')}>
        <Step n={2} title={t('notify.title')} hint={t('chooseOne')} />
        <Segment<Notify>
          value={notify}
          onChange={setNotify}
          options={[
            { id: 'email', label: t('notify.email') },
            { id: 'phone', label: t('notify.phone') },
          ]}
        />
        {notify === 'email' ? (
          <label className="flex flex-col gap-1.5 text-[14px] font-medium">
            {t('notify.emailLabel')}
            <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-[14px] font-medium">
            {t('notify.phoneLabel')}
            <input className={inputClass} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
          </label>
        )}
      </section>

      {failed ? (
        <p role="alert" data-testid="checkout-error" className="m-0 rounded-field bg-canvas-2 px-4 py-3 text-[14.5px] font-medium">
          {t('error')}
        </p>
      ) : null}

      <InstoreBottomBar label={t('barLabel')}>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => void submit()}
          data-testid="place-order"
          className="transition-press min-h-14 w-full rounded-pill border-0 bg-accent px-6 text-[17px] font-bold text-surface disabled:cursor-not-allowed disabled:bg-canvas-2 disabled:text-ink-3"
        >
          {busy ? t('placing') : ready ? t('place') : hint}
        </button>
      </InstoreBottomBar>
      <button type="button" onClick={open} className="sr-only">
        {t('scanAnother')}
      </button>
    </div>
  );
}
