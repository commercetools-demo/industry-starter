// Environment switches of the portal auth screens (workstream R). Pure functions of an env object so tests can pass one.

/** Demo login: explicit opt-in and impossible in a production build (spec design-demo-login). */
export function isDemoLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEMO_LOGIN_ENABLED === 'true';
}

/**
 * On-screen password reset (owner Q-P01: nothing is mailed). Anyone who knows an email can reset that account, so this is
 * for demo and development only (known gap for Z and X): `DEMO_ONSCREEN_RESET=true`, the one spelling of both apps (Q-X10).
 */
export function isOnscreenResetEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEMO_ONSCREEN_RESET?.trim().toLowerCase() === 'true';
}

/** Store Copilot (panel and /api/copilot routes): off until `PORTAL_COPILOT_ENABLED=true`. */
export function isCopilotEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PORTAL_COPILOT_ENABLED?.trim().toLowerCase() === 'true';
}

/** A return path from `?next=` is accepted only when it is an in-app absolute path: one leading slash, no scheme, no `//`. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  try {
    const url = new URL(value, 'http://portal.invalid');
    return url.origin === 'http://portal.invalid' ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}
