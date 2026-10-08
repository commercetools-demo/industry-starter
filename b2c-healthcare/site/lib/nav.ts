// Navigation model shared by the header, the mobile menu and the footer (design-storefront-shell).
// Pure data and functions: no React, no server-only imports.

/** Width below which the header links collapse into the menu. Mirrors `--breakpoint-nav` in app/globals.css. */
export const NAV_BREAKPOINT_PX = 900;

export type NavSection = 'remote' | 'office' | 'prescriptions' | 'labs';

export interface NavLink {
  section: NavSection;
  /** Locale-less path (the routing helpers add the locale prefix). */
  href: string;
  /** Key under `shell.nav` in the message catalog. */
  labelKey: 'remote' | 'office' | 'prescriptions' | 'labs';
}

export const NAV_LINKS: readonly NavLink[] = [
  { section: 'remote', href: '/doctors/remote', labelKey: 'remote' },
  { section: 'office', href: '/doctors/office', labelKey: 'office' },
  { section: 'prescriptions', href: '/prescriptions', labelKey: 'prescriptions' },
  { section: 'labs', href: '/account/labs', labelKey: 'labs' },
];

/** Route prefixes that belong to each section. A prefix matches itself and everything below it. */
const SECTION_PREFIXES: Record<NavSection, readonly string[]> = {
  remote: ['/doctors/remote'],
  office: ['/doctors/office'],
  // Buying medicine is one journey: lookup, cart, checkout and the order page.
  prescriptions: ['/prescriptions', '/cart', '/checkout', '/order'],
  // `/labs` is the prototype's alias of `/account/labs`.
  labs: ['/account/labs', '/labs'],
};

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * The header section a locale-less pathname belongs to, or null (home, account overview, doctor
 * profiles, ...). Query strings, hashes and a trailing slash are ignored.
 */
export function activeSection(pathname: string): NavSection | null {
  const path = (pathname.split(/[?#]/)[0] ?? '').replace(/\/+$/, '') || '/';
  for (const link of NAV_LINKS) {
    if (SECTION_PREFIXES[link.section].some((prefix) => matchesPrefix(path, prefix))) return link.section;
  }
  return null;
}

/** The home page (locale-less) gets the marketing header and footer. */
export function isHomePath(pathname: string): boolean {
  return (pathname.replace(/\/+$/, '') || '/') === '/';
}

export interface FooterLink {
  labelKey: string;
  href: string;
  /**
   * Whether the page exists. Links to pages that are not built yet are omitted (spec: every footer
   * link goes to a real page or is omitted). Workstream V flips About and Contact when it ships them.
   */
  live: boolean;
}

export interface FooterColumn {
  /** Key under `shell.footer`. */
  headingKey: 'care' | 'pharmacy' | 'company';
  links: readonly FooterLink[];
}

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    headingKey: 'care',
    links: [
      { labelKey: 'videoSessions', href: '/doctors/remote', live: true },
      { labelKey: 'officeVisits', href: '/doctors/office', live: true },
      { labelKey: 'labTests', href: '/account/labs', live: true },
    ],
  },
  {
    headingKey: 'pharmacy',
    links: [
      { labelKey: 'orderMedicine', href: '/prescriptions', live: true },
      { labelKey: 'prescriptions', href: '/prescriptions', live: true },
    ],
  },
  {
    headingKey: 'company',
    links: [
      { labelKey: 'about', href: '/about', live: true },
      { labelKey: 'contact', href: '/contact', live: true },
      { labelKey: 'faq', href: '/faq', live: true },
      { labelKey: 'shipping', href: '/policies/shipping-and-returns', live: true },
      { labelKey: 'terms', href: '/policies/terms', live: true },
      { labelKey: 'privacy', href: '/policies/privacy', live: true },
    ],
  },
];
