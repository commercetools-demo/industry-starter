import { setRequestLocale } from 'next-intl/server';
import { SignInCard } from '@/components/account/SignInCard';
import { redirect } from '@/i18n/routing';
import { resolveLoginDestination } from '@/lib/login-destination';
import { DEMO_PATIENTS, demoLoginEnabled } from '@/lib/demo-login';
import { getSession } from '@/lib/session';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Sign in / create account. `?next=` (a locale path, validated by `sanitizeNext`) is where the patient
// lands afterwards; anything else falls back to /account. A signed-in patient is sent there at once.
export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SearchParams }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const destination = resolveLoginDestination(query.next);
  const session = await getSession();
  if (session.customerId) redirect({ href: destination.path, locale: destination.locale ?? locale });
  const mode = query.mode === 'register' ? 'up' : 'in';
  const demoPatients = demoLoginEnabled() ? DEMO_PATIENTS.map(({ slug, label }) => ({ slug, label })) : [];
  return <SignInCard next={destination.path} reason={destination.reason} initialMode={mode} demoPatients={demoPatients} />;
}
