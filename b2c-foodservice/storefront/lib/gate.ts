import { cookies } from 'next/headers';
import { routing } from '@/i18n/routing';
import { GATE_COOKIE, isGateEnabled, isGateOpen } from '@ct-demos/demotools/tracker/server';

export { GATE_COOKIE, gateSlug, trackerOrigin, isGateEnabled, siteIsOpen } from '@ct-demos/demotools/tracker/server';

export const GATE_HOME_PATH = `/${routing.defaultLocale}`;

/**
 * The page-builder preview deployment has no gate: Merchant Center frames it cross-site, where the gate cookie is not sent, so a
 * gate would show the editor a login page. It is the same switch that allows framing (`PB_ALLOW_MC_FRAMING`, never set on production).
 */
export function isPreviewDeployment(env: Record<string, string | undefined> = process.env): boolean {
  return env.PB_ALLOW_MC_FRAMING === 'true';
}

/** Gate disabled (dev, no slug, or the preview deployment) or the visitor carries the cookie. No per-render fetch. */
export async function isDemoGateOpen(): Promise<boolean> {
  if (isPreviewDeployment() || !isGateEnabled()) return true;
  return isGateOpen((await cookies()).get(GATE_COOKIE)?.value);
}
