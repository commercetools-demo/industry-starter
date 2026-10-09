import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import type { PolicySlug } from '@/lib/content';

/**
 * Link to a policy for consent text (checkout). It opens in a new tab so the buyer never leaves the
 * checkout page: the cart, addresses and selections stay exactly as they were.
 */
export function PolicyLink({ slug, children, className }: { slug: PolicySlug; children: ReactNode; className?: string }) {
  return (
    <Link href={`/policies/${slug}`} target="_blank" rel="noopener" className={className ?? 'text-text-link underline hover:text-brand-800'}>
      {children}
    </Link>
  );
}
