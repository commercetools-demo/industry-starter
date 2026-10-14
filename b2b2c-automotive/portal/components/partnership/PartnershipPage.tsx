'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Chip } from '@/components/portal/Chip';
import { buttonSmall, cardClass, errorNote, infoNote, sectionTitle } from '@/components/portal/kit';
import { useViewer } from '@/context/ViewerContext';
import { usePartnership, type Partnership } from '@/hooks/marketingApi';
import { Link } from '@/i18n/routing';

const nameOf = (name: Record<string, string>, locale: string) => name[locale] ?? name['en-US'] ?? Object.values(name)[0] ?? '';

/** The guardrails that still exist (fitment claims Enforced, prices Informational), the two KPIs and the pending fitment claims. */
export function PartnershipView({ data }: { data: Partnership }) {
  const t = useTranslations('partnership');
  const locale = useLocale();
  const { compliance, claimsPending } = data.kpis;
  return (
    <div className="flex flex-col gap-400">
      <section aria-labelledby="partnership-rules" className={`${cardClass} flex flex-col gap-400`}>
        <h2 id="partnership-rules" className={sectionTitle}>
          {t('rulesTitle')}
        </h2>
        <ul className="flex flex-col gap-300">
          {data.rules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-start justify-between gap-300 rounded-300 bg-bg-surface-subdued px-400 py-300">
              <div className="min-w-0 flex-1">
                <h3 className="text-body-1 font-semibold text-text">{t(`rules.${rule.id}.title`)}</h3>
                <p className="text-body-2 font-medium text-text-subdued">{t(`rules.${rule.id}.text`)}</p>
              </div>
              <Chip tone={rule.state === 'Enforced' ? 'success' : 'info'}>{t(`states.${rule.state}`)}</Chip>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={t('kpi.compliance')} className="grid gap-400 sm:grid-cols-2">
        <div className={`${cardClass} flex flex-col gap-100`}>
          <p className="text-body-2 font-semibold text-text-subdued">{t('kpi.compliance')}</p>
          <p data-testid="kpi-compliance" className="text-h4 font-semibold text-text">
            {compliance.score === null ? t('kpi.noScore') : `${compliance.score} %`}
          </p>
          <p className="text-caption-1 font-medium text-text-subdued">{t('kpi.openFlags', { count: compliance.flags })}</p>
        </div>
        <div className={`${cardClass} flex flex-col gap-100`}>
          <p className="text-body-2 font-semibold text-text-subdued">{t('kpi.claimsPending')}</p>
          <p data-testid="kpi-claims" className="text-h4 font-semibold text-text">
            {claimsPending}
          </p>
          <p className="text-caption-1 font-medium text-text-subdued">{t('kpi.claimsHint')}</p>
        </div>
      </section>

      <section aria-labelledby="partnership-flags" className={`${cardClass} flex flex-col gap-400`}>
        <h2 id="partnership-flags" className={sectionTitle}>
          {t('flagsTitle')}
        </h2>
        {data.flags.length === 0 ? (
          <p className={infoNote}>{t('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-300">
            {data.flags.map((flag) => (
              <li key={flag.part.key} className="flex flex-wrap items-center justify-between gap-300 rounded-300 border border-border px-400 py-300">
                <div className="min-w-0 flex-1">
                  <p className="text-body-1 font-semibold text-text">
                    {nameOf(flag.part.name, locale)} <span className="font-mono text-body-2 font-medium text-text-subdued">{flag.part.sku}</span>
                  </p>
                  <p className="text-body-2 font-medium text-text-subdued">{t('flagReason')}</p>
                  {flag.claimedVehicles.length ? <p className="text-caption-1 font-medium text-text-subdued">{t('claimedVehicles', { vehicles: flag.claimedVehicles.map((v) => v.split('|').slice(0, 2).join(' ')).join(', ') })}</p> : null}
                </div>
                <Link href={flag.fixHref} className={buttonSmall} aria-label={t('viewPart', { sku: flag.part.sku })}>
                  {t('view')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function PartnershipPage() {
  const t = useTranslations('partnership');
  const { storeKey } = useViewer();
  const { data, error } = usePartnership(storeKey);
  if (error) {
    return (
      <p role="alert" className={errorNote}>
        {t('error')}
      </p>
    );
  }
  if (!data) {
    return (
      <p role="status" className={infoNote}>
        {t('loading')}
      </p>
    );
  }
  return <PartnershipView data={data} />;
}
