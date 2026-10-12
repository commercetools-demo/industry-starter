'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AudienceCampaigns } from '@/components/email/AudienceCampaigns';
import { EventsPanel } from '@/components/email/EventsPanel';
import { TemplateEditor } from '@/components/email/TemplateEditor';
import { Chip } from '@/components/portal/Chip';
import { cardClass, errorNote, infoNote, sectionTitle } from '@/components/portal/kit';
import { useViewer } from '@/context/ViewerContext';
import { useEmailTemplates } from '@/hooks/marketingApi';

export type EmailTab = 'templates' | 'campaigns';
const TABS: EmailTab[] = ['templates', 'campaigns'];
const TEMPLATE_KEYS = ['order-confirmation', 'shipment-update', 'win-back'] as const;

/** E-mail page body: Templates (list, editor with preview, order events) and Campaigns. Stored only, nothing is sent (Q-P01). */
export function EmailPage({ initialTab = 'templates' }: { initialTab?: EmailTab }) {
  const t = useTranslations('email');
  const tn = useTranslations('email.templates.names');
  const tt = useTranslations('email.templates');
  const { storeKey } = useViewer();
  const { data, error } = useEmailTemplates(storeKey);
  const [tab, setTab] = useState<EmailTab>(initialTab);
  const [selected, setSelected] = useState<(typeof TEMPLATE_KEYS)[number]>('order-confirmation');
  const template = data?.templates.find((x) => x.key === selected);

  return (
    <div className="flex flex-col gap-500">
      <p className={infoNote}>{t('note')}</p>
      <div role="tablist" aria-label={t('tabs.label')} className="flex w-max gap-100 rounded-300 bg-bg-surface-subdued p-100">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`email-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`email-panel-${id}`}
            onClick={() => setTab(id)}
            className={`inline-flex h-1000 items-center rounded-200 px-400 text-body-2 font-semibold focus-visible:outline-2 focus-visible:outline-border-active ${tab === id ? 'bg-bg-surface text-text shadow-button' : 'text-text-subdued hover:text-text'}`}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'templates' ? (
        <div role="tabpanel" id="email-panel-templates" aria-labelledby="email-tab-templates" className="flex flex-col gap-500">
          {error ? (
            <p role="alert" className={errorNote}>
              {t('errors.generic')}
            </p>
          ) : null}
          <section aria-labelledby="template-list-title" className={`${cardClass} flex flex-col gap-300`}>
            <h2 id="template-list-title" className={sectionTitle}>
              {tt('title')}
            </h2>
            <ul aria-label={tt('list')} className="flex flex-col gap-200">
              {TEMPLATE_KEYS.map((key) => {
                const item = data?.templates.find((x) => x.key === key);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={selected === key}
                      onClick={() => setSelected(key)}
                      className={`flex w-full items-center justify-between gap-300 rounded-300 border border-border px-400 py-300 text-left text-body-2 font-semibold text-text hover:bg-bg-surface-hover focus-visible:outline-2 focus-visible:outline-border-active ${selected === key ? 'bg-bg-surface-subdued' : ''}`}
                    >
                      <span>{tn(key)}</span>
                      {item ? <Chip tone={item.stored ? (item.enabled ? 'success' : 'neutral') : 'neutral'}>{item.stored ? (item.enabled ? tt('savedText') : tt('disabledText')) : tt('defaultText')}</Chip> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          {template && data ? <TemplateEditor key={template.key} template={template} brand={data.brand} /> : null}
          {data ? <EventsPanel events={data.events} /> : null}
        </div>
      ) : (
        <div role="tabpanel" id="email-panel-campaigns" aria-labelledby="email-tab-campaigns">
          <AudienceCampaigns />
        </div>
      )}
    </div>
  );
}
