// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';
import type { SpecRow } from '@/lib/types';

/** The specification table (locked data of the master projection); row labels come from the catalogues. */
export function Specifications({ specs }: { specs: SpecRow[] }) {
  const t = useTranslations('pdp');
  if (specs.length === 0) return null;
  return (
    <div>
      <h2 className="m-0 mb-3 font-display text-lg font-semibold text-text">{t('specifications')}</h2>
      <table className="w-full border-collapse font-ui text-sm">
        <tbody>
          {specs.map((spec) => (
            <tr key={spec.name} className="border-b border-border">
              <th scope="row" className="py-3 pr-4 text-left font-normal text-text-muted">
                {t(`spec-${spec.name}` as never)}
              </th>
              <td className="py-3 text-right font-medium text-text">{spec.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
