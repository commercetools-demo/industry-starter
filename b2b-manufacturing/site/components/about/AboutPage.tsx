import { SlotImage } from '@/components/ui/SlotImage';
import { useTranslations } from 'next-intl';
import { ROUTES } from '@/lib/site';
import { AudienceCard, CertChip, CertRow, CtaBand, PageHeader, SampleMarker } from '@/components/ui/content';

/** Accreditations shown until the owner supplies the real list (replace with content/accreditations.json once it exists). */
const ACCREDITATIONS = [
  { key: 'acc1', sample: true },
  { key: 'acc2', sample: true },
  { key: 'acc3', sample: true },
  { key: 'acc4', sample: true },
] as const;

const PRINCIPLES = ['principle1', 'principle2', 'principle3'] as const;

/** Static About page body: header, story, accreditations, principles, closing band (in that order). */
export function AboutPage() {
  const t = useTranslations('about');
  const anySample = ACCREDITATIONS.some((a) => a.sample);
  return (
    <>
      <PageHeader breadcrumb={{ homeLabel: t('breadcrumbHome'), current: t('title') }} title={t('title')} lead={t('lead')} />
      <section className="s" aria-labelledby="about-story"><div className="wrap grid g2" style={{ alignItems: 'center', gap: 64 }}>
        <div>
          <h2 id="about-story" style={{ font: '600 32px/1.2 var(--font-display)', marginBottom: 16 }}>{t('storyTitle')}</h2>
          <p style={{ color: 'var(--fg2)', marginBottom: 16 }}>{t('storyP1')}</p>
          <p style={{ color: 'var(--fg2)' }}>{t('storyP2')}</p>
        </div>
        <SlotImage slot="team-fleet" height={360} />
      </div></section>
      <section className="s g" aria-labelledby="about-acc"><div className="wrap">
        <div className="sh"><div><h2 id="about-acc">{t('accreditationsTitle')}</h2></div>{anySample ? <SampleMarker label={t('sample')} /> : null}</div>
        <CertRow>{ACCREDITATIONS.map((a) => <CertChip key={a.key} title={t(`${a.key}Title`)} caption={t(`${a.key}Caption`)} />)}</CertRow>
      </div></section>
      <section className="s" aria-labelledby="about-principles"><div className="wrap">
        <div className="sh"><div><h2 id="about-principles">{t('principlesTitle')}</h2></div></div>
        <div className="grid g3">{PRINCIPLES.map((p) => <AudienceCard key={p} title={t(`${p}Title`)} body={t(`${p}Body`)} />)}</div>
      </div></section>
      <CtaBand title={t('ctaTitle')} cta={t('ctaButton')} href={ROUTES.quote} />
    </>
  );
}
