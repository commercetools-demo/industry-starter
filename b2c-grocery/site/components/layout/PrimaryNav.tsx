'use client';

import { useSearchParams } from 'next/navigation';
import { usePathname } from '@/i18n/routing';
import { NavLinks, type NavKey } from './NavLinks';

function activeItem(pathname: string, sort: string | null | undefined): NavKey | null {
  if (pathname === '/journal' || pathname.startsWith('/journal/')) return 'journal';
  if (pathname === '/shop' || pathname.startsWith('/shop/')) return sort === 'newest' ? 'new' : 'shop';
  return null;
}

/** Client leaf: marks the current section with `aria-current="page"`. Everything else in `Header` stays on the server. */
export function PrimaryNav({ stacked, onNavigate, className }: { stacked?: boolean; onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <NavLinks active={activeItem(pathname, searchParams?.get('sort'))} stacked={stacked} onNavigate={onNavigate} className={className} />;
}
