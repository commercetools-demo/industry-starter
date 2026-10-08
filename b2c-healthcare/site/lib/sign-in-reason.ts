/** Why the sign-in card was opened; selects the reason line under its title. Keys under `auth.reason`. */
export type AuthReason = 'cart' | 'prescriptions' | 'checkout' | 'order' | 'labs' | 'account';

// Longest prefix first is not needed: the prefixes do not overlap.
const PREFIXES: readonly (readonly [string, AuthReason])[] = [
  ['/cart', 'cart'],
  ['/prescriptions', 'prescriptions'],
  ['/checkout', 'checkout'],
  ['/order', 'order'],
  ['/account/labs', 'labs'],
  ['/labs', 'labs'],
  ['/account', 'account'],
];

/** Reason line for a locale-less destination path (`/cart`), or null when the visitor just opened /login. */
export function reasonForPath(path: string | null | undefined): AuthReason | null {
  if (!path) return null;
  const pathname = path.split(/[?#]/)[0] ?? '';
  for (const [prefix, reason] of PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return reason;
  }
  return null;
}
