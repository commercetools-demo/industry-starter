import { useTranslations } from 'next-intl';
import { PageHeader, SampleMarker } from '@/components/ui/content';

/** Privacy notice (Q-026): placeholder legal copy, flagged sample; retention and contact are owner-to-confirm. */
export function PrivacyPage() {
  const t = useTranslations('privacy');
  const simple = ['why', 'cookies', 'rights'] as const;
  return (
    <>
      <PageHeader breadcrumb={{ homeLabel: t('breadcrumbHome'), current: t('title') }} title={t('title')} lead={t('lead')} />
      <section className="s"><div className="wrap" style={{ maxWidth: 800 }}>
        <p style={{ marginBottom: 32 }}><SampleMarker label={t('sample')} /> <span style={{ color: 'var(--fg2)' }}>{t('samplePage')}</span></p>
        <h2 style={{ font: '600 24px/1.2 var(--font-display)', margin: '0 0 12px' }}>{t('whoTitle')}</h2>
        <p style={{ color: 'var(--fg2)', marginBottom: 32 }}>{t('whoBody')}</p>
        <h2 style={{ font: '600 24px/1.2 var(--font-display)', margin: '0 0 12px' }}>{t('collectTitle')}</h2>
        <p style={{ color: 'var(--fg2)', marginBottom: 8 }}>{t('collectIntro')}</p>
        <ul style={{ color: 'var(--fg2)', paddingLeft: 20, marginBottom: 32 }}>
          {(['collect1', 'collect2', 'collect3'] as const).map((k) => <li key={k}>{t(k)}</li>)}
        </ul>
        {simple.slice(0, 1).map((k) => (
          <div key={k}><h2 style={{ font: '600 24px/1.2 var(--font-display)', margin: '0 0 12px' }}>{t(`${k}Title`)}</h2><p style={{ color: 'var(--fg2)', marginBottom: 32 }}>{t(`${k}Body`)}</p></div>
        ))}
        <h2 style={{ font: '600 24px/1.2 var(--font-display)', margin: '0 0 12px' }}>{t('retentionTitle')} <SampleMarker label={t('confirm')} /></h2>
        <p style={{ color: 'var(--fg2)', marginBottom: 32 }}>{t('retentionBody')}</p>
        {simple.slice(1).map((k) => (
          <div key={k}><h2 style={{ font: '600 24px/1.2 var(--font-display)', margin: '0 0 12px' }}>{t(`${k}Title`)}</h2><p style={{ color: 'var(--fg2)', marginBottom: 32 }}>{t(`${k}Body`)}</p></div>
        ))}
        <h2 style={{ font: '600 24px/1.2 var(--font-display)', margin: '0 0 12px' }}>{t('contactTitle')} <SampleMarker label={t('confirm')} /></h2>
        <p style={{ color: 'var(--fg2)' }}>{t('contactBody')}</p>
      </div></section>
    </>
  );
}
