import { cookies } from 'next/headers';
import { routing } from '@/i18n/routing';
import { GATE_COOKIE, isGateEnabled, isGateOpen } from '@ct-demos/demotools/tracker/server';

export { GATE_COOKIE, gateSlug, trackerOrigin, isGateEnabled, siteIsOpen } from '@ct-demos/demotools/tracker/server';

export const GATE_HOME_PATH = `/${routing.defaultLocale}`;

/** Gate disabled (dev, or no slug) or the visitor carries the cookie. No per-render fetch. */
export async function isDemoGateOpen(): Promise<boolean> {
  if (!isGateEnabled()) return true;
  return isGateOpen((await cookies()).get(GATE_COOKIE)?.value);
}
