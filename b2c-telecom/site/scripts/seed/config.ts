// Seeding safety configuration (D-054). The allow-list has exactly one entry.
export const ALLOWED_PROJECT_KEYS = ['spec-test-b2c-telecom'] as const;
export const OWNED_PREFIX = 'malva-';
export const OWNED_UNPREFIXED_KEYS = {
  customerGroup: ['consumer', 'small-business', 'employee', 'existing-customer'],
} as const;
export const SKU_PREFIX = 'MLV-';

export type Mode = 'read' | 'write';

export const EXIT = {
  OK: 0,
  FAILED: 1,
  TARGET_REFUSED: 2,
  PREFLIGHT: 3,
  SKIPPED: 4,
  GATE: 5,
  SEARCH_NOT_READY: 6,
  /** A release apply failed and its compensation failed too (workstream X). */
  INCONSISTENT: 7,
} as const;

export class TargetError extends Error {
  readonly exitCode = EXIT.TARGET_REFUSED;
  constructor(message: string) {
    super(message);
    this.name = 'TargetError';
  }
}

function isAllowed(key: string): boolean {
  return (ALLOWED_PROJECT_KEYS as readonly string[]).includes(key);
}

export function assertTarget(opts: { envProjectKey: string; confirmProject?: string; mode: Mode }): void {
  const { envProjectKey, confirmProject, mode } = opts;
  if (!isAllowed(envProjectKey)) {
    const verb = mode === 'write' ? 'write' : 'read';
    throw new TargetError(
      `Refusing to ${verb}: project "${envProjectKey}" is not in the allow-list (allowed: ${ALLOWED_PROJECT_KEYS.join(', ')})`,
    );
  }
  if (mode === 'write' && confirmProject !== envProjectKey) {
    throw new TargetError(`Refusing to write: pass --confirm-project <key> naming the target project (found "${envProjectKey}")`);
  }
}

/** Rule 3: the credentials must belong to the project they name. */
export function assertEchoedKey(envProjectKey: string, echoedKey: unknown): void {
  if (echoedKey !== envProjectKey) {
    throw new TargetError(`Refusing: credentials belong to project "${String(echoedKey)}" (expected "${envProjectKey}")`);
  }
}

export function isOwnedKey(kind: string, key: string): boolean {
  if (key.startsWith(OWNED_PREFIX)) return true;
  const extra = (OWNED_UNPREFIXED_KEYS as Record<string, readonly string[]>)[kind];
  return extra?.includes(key) ?? false;
}
