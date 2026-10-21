import { POLICY_SLUGS, aboutHref, contactHref, faqHref, journalHref, policyHref } from '@/lib/routes';

/**
 * Footer link lists. `labelKey` is under `shell.footer.link.`; `category` links resolve through the category tree.
 * Targets owned by other workstreams (P content pages, J account) are listed in BUILT_ROUTES once they exist; until then
 * the link goes to `/` so the footer never has a dead link (IDEAS.md row "footer link targets").
 */
export interface FooterLink {
  labelKey: string;
  /** Path without locale prefix. */
  href?: string;
  /** Category key (mcf-cat-*); the href comes from the tree. */
  categoryKey?: string;
  /** Renders a button that opens the store picker instead of a link. */
  action?: 'choose-store';
}

export interface FooterColumn {
  id: 'shop' | 'collect' | 'help' | 'company';
  /** Shown only in markets with collection (US). */
  collectionOnly?: boolean;
  links: FooterLink[];
}

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    id: 'shop',
    links: [
      { labelKey: 'pods', categoryKey: 'mcf-cat-pods' },
      { labelKey: 'coffee', categoryKey: 'mcf-cat-coffee' },
      { labelKey: 'machines', categoryKey: 'mcf-cat-machines' },
      { labelKey: 'accessories', categoryKey: 'mcf-cat-accessories' },
      { labelKey: 'gifts', categoryKey: 'mcf-cat-gifts' },
    ],
  },
  {
    id: 'collect',
    collectionOnly: true,
    links: [
      { labelKey: 'chooseStore', action: 'choose-store' },
      { labelKey: 'howCollectionWorks', href: faqHref('collecting-how') },
    ],
  },
  {
    id: 'help',
    links: [
      { labelKey: 'contact', href: '/contact' },
      { labelKey: 'faq', href: '/faq' },
      { labelKey: 'shippingReturns', href: '/policies/shipping-returns' },
      { labelKey: 'trackOrder', href: '/account/orders' },
    ],
  },
  {
    id: 'company',
    links: [
      { labelKey: 'about', href: '/about' },
      { labelKey: 'journal', href: '/journal' },
    ],
  },
];

export const FOOTER_LEGAL: Array<{ labelKey: 'privacy' | 'terms' | 'accessibility'; href: string }> = [
  { labelKey: 'privacy', href: '/policies/privacy' },
  { labelKey: 'terms', href: '/policies/terms' },
  { labelKey: 'accessibility', href: '/policies/accessibility' },
];

/**
 * Routes that exist in the app. Add a path here when its page lands (workstream P and J); everything else links to `/`.
 * P built the content pages (about, contact, FAQ, journal, policies); the account links wait for J and L.
 */
export const BUILT_ROUTES: ReadonlySet<string> = new Set<string>([
  aboutHref(),
  contactHref(),
  faqHref(),
  journalHref(),
  ...POLICY_SLUGS.map(policyHref),
  // Workstream L: account area (the tab pages are guarded; a guest lands on sign-in with the path kept).
  '/account/orders',
  '/account/collection',
  '/account/subscriptions',
  '/account/saved',
  '/account/addresses',
  '/account/payment-methods',
  '/account/reviews',
  '/account/profile',
  '/account/settings',
]);

/** The path decides (a query such as `?q=` does not), so a deep link into a built page stays a link. */
export function footerHref(href: string): string {
  return BUILT_ROUTES.has(href.split('?')[0]) ? href : '/';
}
