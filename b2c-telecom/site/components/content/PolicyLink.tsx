import type { ReactElement, ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { legalPath, type LegalSlug } from '@/lib/content/legal-slugs';

type PolicyLinkProps = { policy: LegalSlug; children: ReactNode; className?: string };

/**
 * Locale-aware link to a policy page that opens in a new tab, so a buyer reading it from checkout never leaves the
 * checkout tab (checkout, workstream U, must use this for its consent text).
 */
export function PolicyLink({ policy, children, className }: PolicyLinkProps): ReactElement {
  return (
    <Link href={legalPath(policy)} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </Link>
  );
}
