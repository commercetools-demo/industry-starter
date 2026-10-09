/** Contact details shown in the chrome (from the design). */
export const EMERGENCY_NUMBER = '0800 555 0142';
export const EMERGENCY_HREF = 'tel:+448005550142';
export const COMMERCIAL_NUMBER = '0800 555 0100';
export const COMMERCIAL_EMAIL = 'quotes@malva.example';

export const ROUTES = { home: '/', plumbing: '/plumbing', waste: '/waste-management', about: '/about', quote: '/request-a-quote', quoteList: '/quote-list', privacy: '/privacy', account: '/account', signIn: '/account/sign-in', register: '/account/register' } as const;

/** Request header set by the proxy: the requested path without the locale, for the portal sign-in return link. */
export const PATH_HEADER = 'x-malva-path';

/** Is `pathname` (locale already removed) inside the section that starts at `href`? */
export const inSection = (pathname: string | null, href: string): boolean => Boolean(pathname) && (pathname === href || pathname!.startsWith(`${href}/`));
