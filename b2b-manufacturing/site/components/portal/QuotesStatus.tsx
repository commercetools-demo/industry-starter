import { useTranslations } from 'next-intl';
import type { Money, ThreadStatus } from '@/lib/portal/types';

const TONE: Record<ThreadStatus, 'info' | 'success' | 'warn' | 'danger' | 'neutral'> = {
  submitted: 'info', preparing: 'info', ready: 'success', accepted: 'success', declined: 'danger', renegotiation: 'warn', cancelled: 'neutral',
};

/** The status is always words; the tone only adds colour (malva-client-portal: status is not conveyed by colour alone). */
export function StatusBadge({ status }: { status: ThreadStatus }) {
  const t = useTranslations('portal.quotes.statuses');
  const tone = TONE[status];
  const style = tone === 'neutral' ? undefined : { background: `var(--sl-${tone}-bg)`, color: `var(--sl-${tone}-fg)` };
  return <span className="tag" data-status={status} style={style}>{t(status)}</span>;
}

export const formatMoney = (money: Money, locale: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: money.currencyCode }).format(money.centAmount / 10 ** money.fractionDigits);
