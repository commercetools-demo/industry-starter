import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { OrderView } from '@/lib/types';

/** The In-store order confirmation (D-062): a calm "being prepared" page with the order's lines and how the shopper is told. Server-rendered from the stored order. */
export default function InstoreConfirmation({ order }: { order: OrderView }) {
  const t = useTranslations('instore.confirmation');
  const first = order.buyer?.name?.split(' ')[0] ?? null;
  const contact = order.email ?? order.buyer?.phone ?? null;
  return (
    <div className="flex flex-col items-center gap-[18px] px-6 pb-8 pt-9 text-center" data-testid="instore-confirmation">
      <span className="flex h-32 w-28 shrink-0 items-center justify-center rounded-[56px_56px_16px_16px] bg-[var(--instore-green-bg)] text-[var(--instore-green-ink)]" aria-hidden="true">
        <svg width="60" height="60" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 20h22v10a10 10 0 0 1-10 10 10 10 0 0 1-12-10z" />
          <path d="M32 22h3a5 5 0 0 1 0 10h-3" />
          <path d="M16 6c-2 3 2 4 0 8M23 6c-2 3 2 4 0 8" />
        </svg>
      </span>
      <h1 className="m-0 font-display text-[34px] font-bold leading-[1.08]">{t('title')}</h1>
      <p className="m-0 max-w-[300px] text-[16px] leading-relaxed text-ink-2">{first ? t('bodyNamed', { name: first }) : t('body')}</p>
      <div className="flex w-full flex-col gap-3 rounded-card border border-line bg-surface p-4 text-left">
        <div className="flex justify-between text-[14px]">
          <span className="text-ink-3">{t('order')}</span>
          <b className="font-display text-[17px]" data-testid="order-number">
            #{order.orderNumber}
          </b>
        </div>
        {order.lines.map((l) => (
          <div key={l.id} className="text-[14px] leading-snug">
            <b>
              {l.quantity} × {l.name}
            </b>
            {l.variantSummary ? (
              <>
                <br />
                <span className="text-ink-2">{l.variantSummary}</span>
              </>
            ) : null}
          </div>
        ))}
        {contact ? (
          <div className="flex justify-between gap-3 border-t-[1.5px] border-line pt-3 text-[14px]">
            <span className="shrink-0 text-ink-3">{t('notify')}</span>
            <b className="text-right [overflow-wrap:anywhere]">{contact}</b>
          </div>
        ) : null}
      </div>
      <Link href="/" className="rounded-pill bg-ink px-8 py-4 text-[16px] font-bold text-canvas no-underline">
        {t('again')}
      </Link>
    </div>
  );
}
