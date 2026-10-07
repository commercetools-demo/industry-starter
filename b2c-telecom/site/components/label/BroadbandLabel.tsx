import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { roboto } from '@/app/fonts';
import { LABEL_LEGAL } from '@/lib/config/label';
import type { BroadbandLabelData, LabelRow } from '@/lib/types';
import styles from './BroadbandLabel.module.css';

const bare = (url: string): string => url.replace(/^https?:\/\//, '');

function Rows({ rows }: { rows: LabelRow[] }): ReactElement | null {
  if (rows.length === 0) return null;
  return (
    <ul className={styles.rows}>
      {rows.map((row) => (
        <li key={row.k} className={styles.row}>
          <span>{row.k}</span>
          <span className={styles.value}>{row.v}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The FCC Broadband Facts label of one plan. Every figure comes from `label` (built by `buildLabel` from catalog data and the engine
 * price); the static texts are English in both locales. No design token is read: see the CSS module.
 */
export function BroadbandLabel({ label }: { label: BroadbandLabelData }): ReactElement {
  const t = useTranslations('label');
  return (
    <article className={styles.label} aria-label={`${t('title')}: ${label.planName}`} data-plan-id={label.id}>
      <div className={`${roboto.className} ${styles.body}`}>
        <h3 className={styles.title}>{t('title')}</h3>

        <section className={`${styles.section} ${styles.rule8}`}>
          <div className={styles.provider}>{LABEL_LEGAL.provider}</div>
          <div className={styles.plan}>{label.planName}</div>
          <div className={styles.kind}>{label.kind}</div>
          <div className={styles.disclosure}>{t('disclosure')}</div>
        </section>

        <section className={`${styles.section} ${styles.rule4}`}>
          <div className={styles.priceRow}>
            <h4 className={styles.priceLabel}>{t('monthlyPrice')}</h4>
            <span className={styles.price}>{label.price}</span>
          </div>
          <div className={styles.note}>{label.priceNote}</div>
          <h5 className={styles.headingSmall}>{t('monthlyFees')}</h5>
          <Rows rows={label.monthlyFees} />
        </section>

        <section className={`${styles.section} ${styles.rule4}`}>
          <h4 className={styles.heading}>{t('oneTimeFees')}</h4>
          <Rows rows={label.oneTime} />
          <h4 className={`${styles.heading} ${styles.headingGap}`}>{t('otherFees')}</h4>
          <Rows
            rows={[
              { k: t('etf'), v: label.etf },
              { k: t('taxes'), v: t('taxesValue') },
            ]}
          />
        </section>

        <section className={`${styles.section} ${styles.rule4}`}>
          <h4 className={styles.heading}>{t('discountsBundles')}</h4>
          <div className={styles.note}>{label.discounts}</div>
        </section>

        <section className={`${styles.section} ${styles.rule8}`}>
          <h4 className={styles.headingLarge}>{t('speeds')}</h4>
          <Rows rows={label.speeds} />
        </section>

        <section className={`${styles.section} ${styles.rule4}`}>
          <h4 className={styles.heading}>{t('data')}</h4>
          <Rows rows={[{ k: t('monthlyData'), v: label.data }]} />
          <div className={styles.small}>{t('additionalData')}</div>
        </section>

        <section className={`${styles.section} ${styles.rule4} ${styles.text}`}>
          <h4 className={styles.heading}>{t('network')}</h4>
          <div>{t('networkText', { networkUrl: bare(LABEL_LEGAL.networkPolicyUrl), privacyUrl: bare(LABEL_LEGAL.privacyUrl) })}</div>
        </section>

        <section className={`${styles.section} ${styles.rule4} ${styles.text}`}>
          <h4 className={styles.heading}>{t('support')}</h4>
          <div>{t('supportText', { phone: LABEL_LEGAL.supportPhone, url: bare(LABEL_LEGAL.supportUrl) })}</div>
        </section>

        <p className={`${styles.rule2} ${styles.footnote}`}>{t('footnote', { fcc: LABEL_LEGAL.fccUrl, id: label.id })}</p>
      </div>
    </article>
  );
}
