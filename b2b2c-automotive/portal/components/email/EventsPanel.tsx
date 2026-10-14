/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useTranslations } from 'next-intl';
import { Chip } from '@/components/portal/Chip';
import { cardClass, infoNote, sectionTitle, tableMinWidth, tableScroll, tdClass, thClass } from '@/components/portal/kit';
import type { EventView } from '@/hooks/marketingApi';

/** Order events with the state of their template: "Stored, not sent" or "Not set up". Nothing is ever sent. */
export function EventsPanel({ events }: { events: EventView[] }) {
  const t = useTranslations('email.events');
  const tn = useTranslations('email.templates.names');
  return (
    <section aria-labelledby="events-title" className={`${cardClass} flex flex-col gap-400`}>
      <h2 id="events-title" className={sectionTitle}>
        {t('title')}
      </h2>
      <p className={infoNote}>{t('note')}</p>
      <div className={tableScroll} role="group" tabIndex={0} aria-labelledby="events-title">
        <table className={`w-full ${tableMinWidth}`} aria-labelledby="events-title">
          <thead>
            <tr>
              <th scope="col" className={thClass}>
                {t('event')}
              </th>
              <th scope="col" className={thClass}>
                {t('template')}
              </th>
              <th scope="col" className={thClass}>
                {t('state')}
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-t border-border">
                <td className={tdClass}>{t(`names.${event.id}`)}</td>
                <td className={tdClass}>{event.template ? tn(event.template) : t('none')}</td>
                <td className={tdClass}>
                  <Chip tone={event.state === 'stored-not-sent' ? 'info' : 'neutral'}>{t(`states.${event.state}`)}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
