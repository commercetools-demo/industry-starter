'use client';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { ACCOUNT_NAV, activeAccountItem } from '@/lib/account-nav';
import { cx } from '@/components/ui/cx';
import { SignOutButton } from './SignOutButton';

/**
 * Frame of every account page: 240 px side navigation (active item azure) with the Sign out button, content on the
 * right. Below 900 px (the `nav:` breakpoint) the navigation stacks above the content. The items come from the
 * `ACCOUNT_NAV` registry.
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const t = useTranslations('account.nav');
  const pathname = usePathname();
  const active = activeAccountItem(pathname);
  return (
    <div className="mx-auto max-w-content px-5 py-8 nav:px-8" data-account-shell>
      <div className="grid items-start gap-8 nav:grid-cols-[240px_1fr]">
        <div className="grid gap-4">
          <nav aria-label={t('label')} className="grid gap-1">
            {ACCOUNT_NAV.map((item) => {
              const current = item === active;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={cx(
                    'rounded-md px-4 py-2.5 font-display text-sm font-medium',
                    current ? 'bg-action text-action-label' : 'text-navy-700 hover:bg-brand-50',
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
          <div>
            <SignOutButton />
          </div>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

/** Heading of an account page (the shell has no page head band). */
export function AccountHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl font-semibold text-navy-900">{title}</h1>
      {sub ? <p className="mt-1.5 text-neutral-600">{sub}</p> : null}
    </div>
  );
}
