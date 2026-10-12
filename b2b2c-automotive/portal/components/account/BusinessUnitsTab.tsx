'use client';

import { useTranslations } from 'next-intl';
import { cardClass, errorNote, hintClass, sectionTitle, tableScroll, tdClass, thClass } from '@/components/portal/kit';
import { useAccountUnits } from '@/hooks/accountApi';

/** Account > Business units: every unit of the signed-in associate with type, role(s) and store ("Explicit store" or "From parent"). */
export function BusinessUnitsTab() {
  const t = useTranslations('account.units');
  const { data, error, isLoading } = useAccountUnits();
  const units = data?.units ?? [];
  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="units-title">
      <div>
        <h2 id="units-title" className={sectionTitle}>
          {t('title')}
        </h2>
        <p className="text-body-2 text-text-subdued">{t('subtitle')}</p>
      </div>
      {error ? (
        <p role="alert" className={errorNote}>
          {t('loadFailed')}
        </p>
      ) : null}
      {isLoading ? (
        <p role="status" className="text-body-2 text-text-subdued">
          {t('loading')}
        </p>
      ) : (
        <div className={tableScroll}>
          <table className="w-full">
            <thead>
              <tr>
                <th className={thClass}>{t('name')}</th>
                <th className={thClass}>{t('type')}</th>
                <th className={thClass}>{t('roles')}</th>
                <th className={thClass}>{t('store')}</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.key} className="border-t border-border-subdued">
                  <td className={tdClass}>{unit.name}</td>
                  <td className={tdClass}>{unit.type}</td>
                  <td className={tdClass}>{unit.roles.join(', ')}</td>
                  <td className={tdClass}>
                    {unit.storeName}
                    <span className={`block ${hintClass}`}>{t(unit.storeMode === 'Explicit' ? 'explicit' : 'fromParent')}</span>
                  </td>
                </tr>
              ))}
              {units.length === 0 ? (
                <tr>
                  <td className={tdClass} colSpan={4}>
                    {t('empty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
