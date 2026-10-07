/** The recurrence policies the storefront offers (seeded by F, read by key; D-034). */
export const RECURRENCE_POLICY_KEYS = ['weekly', 'every-2-weeks', 'monthly'] as const;
export type RecurrencePolicyKey = (typeof RECURRENCE_POLICY_KEYS)[number];

export const isRecurrencePolicyKey = (value: unknown): value is RecurrencePolicyKey =>
  typeof value === 'string' && (RECURRENCE_POLICY_KEYS as readonly string[]).includes(value);

/** Only the exact string `false` switches subscriptions off (default on). Pure so it can be tested without touching `process.env`. */
export const parseSubscriptionsFlag = (value: string | undefined): boolean => value !== 'false';

/**
 * `FEATURE_SUBSCRIPTIONS` (server-side env, never `NEXT_PUBLIC`): hides every subscription UI and answers 404 on every
 * subscription API when `false`. Server components pass the result to client components as a prop.
 */
export const subscriptionsEnabled = (): boolean => parseSubscriptionsFlag(process.env.FEATURE_SUBSCRIPTIONS);
