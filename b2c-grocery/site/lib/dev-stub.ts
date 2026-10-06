type Links = Map<string, string>;
type DevGlobal = typeof globalThis & { __devResetLinks?: Links };

/**
 * Development-only stand-in for the reset email (D-038). Kept on `globalThis` so route handlers and pages share
 * it even though `next dev` bundles them separately. Never used in production: callers check `isDevStubEnabled()`.
 */
const links = (): Links => ((globalThis as DevGlobal).__devResetLinks ??= new Map());

export const isDevStubEnabled = (): boolean => process.env.NODE_ENV === 'development';

export function setLastResetLink(email: string, url: string): void {
  const map = links();
  map.delete(email);
  map.set(email, url);
}

/** The most recently created reset link, or `null`. */
export function getLastResetLink(): { email: string; url: string } | null {
  const last = [...links().entries()].at(-1);
  return last ? { email: last[0], url: last[1] } : null;
}
