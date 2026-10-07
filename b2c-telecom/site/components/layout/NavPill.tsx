'use client';

import type { ReactElement } from 'react';
import { Pill } from '@/components/ui/Pill';
import { usePathname } from '@/i18n/routing';
import { activeNavKey, type NavItem } from '@/lib/nav';

/** Header nav item: a dark pill when the current route belongs to this root category. */
export function NavPill({ item, items }: { item: NavItem; items: NavItem[] }): ReactElement {
  const pathname = usePathname();
  const active = activeNavKey(pathname, items) === item.key;
  return (
    <Pill href={item.path} active={active} aria-current={active ? 'page' : undefined}>
      {item.label}
    </Pill>
  );
}
