import 'server-only';
import { unstable_cache } from 'next/cache';
import { RECURRENCE_POLICY_KEYS } from '../config/features';
import { getLocalizedString } from '../utils';
import { getApiRoot } from './client';

export const RECURRENCE_POLICIES_REVALIDATE_SECONDS = 300;

export interface RecurrencePolicyOption {
  key: string;
  id: string;
  name: string;
}

/** The option plus the standard schedule (for example 2 Weeks), used to match a Recurring Order to its policy. */
export interface PolicyWithSchedule extends RecurrencePolicyOption {
  schedule: { value: number; intervalUnit: string } | null;
}

async function fetchPolicies(locale: string): Promise<PolicyWithSchedule[]> {
  const { body } = await getApiRoot()
    .recurrencePolicies()
    .get({ queryArgs: { where: `key in (${RECURRENCE_POLICY_KEYS.map((k) => `"${k}"`).join(', ')})`, limit: 50 } })
    .execute();
  const order = (key: string) => (RECURRENCE_POLICY_KEYS as readonly string[]).indexOf(key);
  return body.results
    .flatMap((p) =>
      p.key
        ? [
            {
              key: p.key,
              id: p.id,
              name: getLocalizedString(p.name as Record<string, string> | undefined, locale) || p.key,
              schedule: p.schedule.type === 'standard' ? { value: p.schedule.value, intervalUnit: p.schedule.intervalUnit } : null,
            },
          ]
        : [],
    )
    .sort((a, b) => order(a.key) - order(b.key));
}

/**
 * The three offered policies (weekly, every 2 weeks, monthly) with the name in the locale, in that order. Public data:
 * cached for 300 s per locale and shared across users, so nothing here may read the session.
 */
export async function getRecurrencePolicies(locale: string): Promise<PolicyWithSchedule[]> {
  const cached = unstable_cache(() => fetchPolicies(locale), ['recurrence-policies', locale], {
    revalidate: RECURRENCE_POLICIES_REVALIDATE_SECONDS,
  });
  return cached();
}
