import { getTranslations } from 'next-intl/server';
import { getContact, text } from '@/lib/content';

/** "Prefer to talk?": commercial phone, email, hours and the emergency line for contracted clients (from content/contact.json). */
export async function ContactAside({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'requestQuote' });
  const c = getContact();
  return (
    <aside className="ql-card" aria-labelledby="rq-aside">
      <h2 id="rq-aside">{t('asideTitle')}</h2>
      <p><b>{t('asideTeam')}</b><br />{text(c.hours, locale)}</p>
      <p><a className="phone" href={c.commercial.href}>{c.commercial.display}</a><br /><a href={`mailto:${c.email}`}>{c.email}</a></p>
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', width: '100%' }} />
      <p>{t('asideEmergency', { number: c.emergency.display })}</p>
    </aside>
  );
}
