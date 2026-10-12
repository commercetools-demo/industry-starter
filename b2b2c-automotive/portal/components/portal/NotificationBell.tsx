'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons/Icon';
import { Link } from '@/i18n/routing';
import { useOverlay } from '@/context/OverlayContext';
import { useViewer } from '@/context/ViewerContext';
import { useNotifications } from '@/hooks/useNotifications';
import type { PortalNotification } from '@/lib/portal/types';

const TITLE_KEYS = { 'order-shipped': 'orderShipped', 'return-received': 'returnReceived' } as const;
const SUB_KEYS = { 'order-shipped': 'orderShippedSub', 'return-received': 'returnReceivedSub' } as const;

function Item({ item, onDismiss, onOpen }: { item: PortalNotification; onDismiss: () => void; onOpen: () => void }) {
  const t = useTranslations('notifications');
  return (
    <li className="flex items-center gap-200 rounded-300 py-050 pl-300 pr-100 hover:bg-bg-surface-hover">
      <Link href={item.href} onClick={onOpen} className="min-w-0 flex-1 py-200 text-left">
        <span className="block text-body-2 font-semibold text-text">{t(TITLE_KEYS[item.kind], item.values)}</span>
        <span className="text-caption-1 font-medium text-text-subdued">{t(SUB_KEYS[item.kind])}</span>
      </Link>
      <button type="button" aria-label={t('dismiss')} title={t('dismiss')} onClick={onDismiss} className="grid size-800 flex-none place-items-center rounded-full text-text hover:bg-bg-surface-pressed">
        <Icon name="close" size="sm" />
      </button>
    </li>
  );
}

/** Bell with the unread count and a panel of notifications, each linking to its page and individually dismissible. */
export function NotificationBell() {
  const t = useTranslations('notifications');
  const viewer = useViewer();
  const overlay = useOverlay();
  const { items, count, dismiss } = useNotifications(viewer.customerId, viewer.businessUnitKey);
  const open = overlay.isOpen('bell');
  return (
    <div className="relative">
      <button
        type="button"
        data-testid="bell"
        aria-label={`${t('title')}${count ? `, ${t('unread', { count })}` : ''}`}
        title={t('title')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => overlay.toggle('bell', e.currentTarget)}
        className="relative grid size-1100 place-items-center rounded-full text-text-on hover:bg-bg-brand-hover"
      >
        <Icon name="bell" />
        {count > 0 ? (
          <span data-testid="bell-count" aria-hidden="true" className="absolute right-150 top-150 min-w-450 rounded-full bg-bg-warning-subdued px-100 text-center text-caption-2 font-bold text-gray-16">
            {count}
          </span>
        ) : null}
      </button>
      {open ? (
        <section role="dialog" aria-label={t('title')} className="absolute right-0 top-full z-60 mt-200 flex w-widget-desktop-4col max-w-[calc(100vw-var(--space-800))] flex-col gap-200 rounded-400 bg-bg-surface p-400 text-text shadow-popover narrow:fixed narrow:inset-x-300 narrow:top-topbar narrow:w-auto narrow:max-w-none">
          <div className="flex items-baseline justify-between">
            <h2 className="text-title-2 font-semibold">{t('title')}</h2>
            <span className="text-caption-1 font-medium text-text-subdued">{t('unread', { count })}</span>
          </div>
          {items.length === 0 ? (
            <p className="py-300 text-caption-1 font-medium text-text-subdued">{t('empty')}</p>
          ) : (
            <ul className="flex flex-col gap-100">
              {items.map((item) => (
                <Item key={item.id} item={item} onDismiss={() => dismiss(item.id)} onOpen={() => overlay.close('bell')} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
