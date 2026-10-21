'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import Icon, { type IconName } from '@/components/ui/Icon';
import { useAuthActions } from '@/hooks/useAuthActions';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/cn';

export type AccountTabId =
  | 'orders' | 'collection' | 'subscriptions' | 'saved' | 'addresses' | 'payments' | 'reviews' | 'profile' | 'settings';

interface TabDef { id: AccountTabId; segment: string; icon: IconName; collectionOnly?: boolean }

/** Order of the tab list (design-account-area). `segment` is the path below /account. */
export const ACCOUNT_TABS: readonly TabDef[] = [
  { id: 'orders', segment: 'orders', icon: 'pkg' },
  { id: 'collection', segment: 'collection', icon: 'store', collectionOnly: true },
  { id: 'subscriptions', segment: 'subscriptions', icon: 'repeat' },
  { id: 'saved', segment: 'saved', icon: 'heart' },
  { id: 'addresses', segment: 'addresses', icon: 'pin' },
  { id: 'payments', segment: 'payment-methods', icon: 'card' },
  { id: 'reviews', segment: 'reviews', icon: 'star' },
  { id: 'profile', segment: 'profile', icon: 'user' },
  { id: 'settings', segment: 'settings', icon: 'settings' },
];

/** The tabs a market shows: the Collection tab only where collection exists (US, D-035). */
export function visibleTabs(collection: boolean): readonly TabDef[] {
  return ACCOUNT_TABS.filter((t) => collection || !t.collectionOnly);
}

const isActive = (pathname: string, segment: string) =>
  pathname === `/account/${segment}` || pathname.startsWith(`/account/${segment}/`);

/** Vertical tab list at 900px and above, a horizontal scroller below it. The active tab scrolls into view on mount. */
export default function AccountTabs({ collection }: { collection: boolean }) {
  const t = useTranslations('account.tabs');
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  return (
    <nav aria-label={t('label')}>
      <ul className="m-0 flex list-none snap-x gap-1.5 overflow-x-auto p-0 stack:flex-col stack:gap-1 stack:overflow-visible">
        {visibleTabs(collection).map((tab) => {
          const active = isActive(pathname, tab.segment);
          return (
            <li key={tab.id} className="shrink-0 snap-start">
              <Link
                ref={active ? activeRef : undefined}
                href={`/account/${tab.segment}`}
                aria-current={active ? 'page' : undefined}
                data-testid={`account-tab-${tab.id}`}
                className={cn(
                  'transition-state flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-field px-3.5 py-3 text-[14px] font-medium',
                  active ? 'bg-ink text-surface' : 'text-ink-2 hover:bg-ink/5',
                )}
              >
                <Icon name={tab.icon} size={18} />
                {t(tab.id)}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 stack:mt-2">
          <button
            type="button"
            onClick={() => void signOut()}
            className="transition-state flex min-h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-field border-0 bg-transparent px-3.5 py-3 text-left text-[14px] font-medium text-ink-3 hover:bg-ink/5"
          >
            <Icon name="logout" size={18} />
            {t('signOut')}
          </button>
        </li>
      </ul>
    </nav>
  );
}
