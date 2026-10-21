import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { policyHref, type PolicySlug } from '@/lib/routes';

/**
 * A link to a policy page that opens in a new tab, so a shopper at checkout keeps their cart, address and selections
 * in the original tab. Workstream K uses this for the terms and privacy links in its consent text.
 */
export default function PolicyLink({ slug, className, children }: { slug: PolicySlug; className?: string; children: ReactNode }) {
  return (
    <Link href={policyHref(slug)} target="_blank" rel="noopener" className={className ?? 'underline underline-offset-2 hover:text-accent'}>
      {children}
    </Link>
  );
}
