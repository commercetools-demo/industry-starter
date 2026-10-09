'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { useRouter } from '@/i18n/routing';
import { readJson, sendJson } from '@/lib/fetcher';
import { ROUTES } from '@/lib/site';
import { safeNextPath } from '@/lib/validation';
import { useAuthActions } from './useAuthActions';

interface DemoUser { email: string; name: string; company: string; role: string }

/** Sign in as one of the seeded sample customers. Rendered only where the server offers any (DEMO_LOGIN_PASSWORD is set). */
export function DemoLogin({ next, onDone }: { next?: string | null; onDone?: () => void }) {
  const t = useTranslations('auth.signIn.demo');
  const router = useRouter();
  const { refreshAll } = useAuthActions();
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void readJson<{ users: DemoUser[] }>('/api/auth/demo-login').then((r) => { if (live && r?.users?.length) { setUsers(r.users); setEmail(r.users[0]!.email); } });
    return () => { live = false; };
  }, []);

  if (!users.length) return null;

  async function signIn() {
    setBusy(true); setError('');
    try {
      await sendJson('/api/auth/demo-login', 'POST', { email });
      await refreshAll();
      onDone?.();
      router.push(safeNextPath(next, ROUTES.account));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('genericError'));
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="demo-login-title" data-testid="demo-login" style={{ display: 'grid', gap: 12, marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--sl-border)' }}>
      <h2 id="demo-login-title" style={{ font: '600 16px var(--font-sans)', margin: 0 }}>{t('title')}</h2>
      <Field as="select" label={t('customer')} name="demoCustomer" value={email} onChange={(e) => setEmail(e.target.value)} error={error || undefined}>
        {users.map((u) => <option key={u.email} value={u.email}>{`${u.name} · ${u.role} · ${u.company}`}</option>)}
      </Field>
      <LiveRegion assertive>{error}</LiveRegion>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void signIn()}>{busy ? t('submitting') : t('submit')}</Button>
    </section>
  );
}
