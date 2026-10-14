'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Chip } from '@/components/portal/Chip';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, buttonSecondary, buttonSmall, cardClass, errorNote, hintClass, infoNote, inputClass, sectionTitle, selectClass, tableMinWidth, tableScroll, tdClass, thClass } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { emailApi, useEmailCampaigns, type SuggestResult } from '@/hooks/marketingApi';

const TEMPLATE_KEYS = ['order-confirmation', 'shipment-update', 'win-back'] as const;

/** Campaigns by audience rule. They are stored as Draft or Ready; nothing is ever sent (the Send control is disabled). */
export function AudienceCampaigns() {
  const t = useTranslations('email.campaigns');
  const tn = useTranslations('email.templates.names');
  const te = useTranslations('email.errors');
  const { storeKey } = useViewer();
  const { toast } = useToast();
  const { data, mutate } = useEmailCampaigns(storeKey);
  const [name, setName] = useState('');
  const [templateKey, setTemplateKey] = useState<string>('win-back');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [suggestion, setSuggestion] = useState<SuggestResult | null>(null);

  const fail = (status: number) => setProblem(status === 403 ? te('forbidden') : te('generic'));

  async function suggest() {
    setBusy(true);
    setProblem('');
    setSuggestion(null);
    const result = await emailApi.suggest(storeKey, description);
    setBusy(false);
    if (!result.ok || !result.data) return fail(result.status);
    setSuggestion(result.data);
  }

  async function useRule() {
    if (!suggestion || !suggestion.ok) return;
    setBusy(true);
    setProblem('');
    const result = await emailApi.createCampaign(storeKey, { name, templateKey, rule: suggestion.rule });
    setBusy(false);
    if (!result.ok) return fail(result.status);
    toast(t('ruleStored'));
    setSuggestion(null);
    setName('');
    setDescription('');
    await mutate();
  }

  async function ready(id: string) {
    setProblem('');
    const result = await emailApi.markReady(storeKey, id);
    if (!result.ok) return fail(result.status);
    toast(t('markedReady'));
    await mutate();
  }

  const campaigns = data?.campaigns ?? [];
  return (
    <div className="flex flex-col gap-500">
      <section aria-labelledby="campaigns-title" className={`${cardClass} flex flex-col gap-400`}>
        <h2 id="campaigns-title" className={sectionTitle}>
          {t('title')}
        </h2>
        {campaigns.length === 0 ? (
          <p className={infoNote}>{t('empty')}</p>
        ) : (
          <div className={tableScroll} role="group" tabIndex={0} aria-label={t('table')}>
            <table aria-label={t('table')} className={`w-full ${tableMinWidth}`}>
              <thead>
                <tr>
                  {(['name', 'rule', 'status', 'recipients', 'openRate', 'actions'] as const).map((c) => (
                    <th key={c} scope="col" className={thClass}>
                      {t(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className={tdClass}>{c.name}</td>
                    <td className={tdClass}>{c.ruleText}</td>
                    <td className={tdClass}>
                      <Chip tone={c.status === 'Ready' ? 'success' : 'neutral'}>{t(`statuses.${c.status}`)}</Chip>
                    </td>
                    <td className={tdClass}>{c.recipientCount ?? t('dash')}</td>
                    <td className={tdClass}>{t('dash')}</td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap items-center gap-200">
                        {c.status === 'Draft' ? (
                          <button type="button" className={buttonSmall} onClick={() => ready(c.id)}>
                            {t('markReady')}
                          </button>
                        ) : null}
                        <button type="button" className={buttonSmall} disabled aria-describedby={`send-note-${c.id}`}>
                          {t('send')}
                        </button>
                        <span id={`send-note-${c.id}`} className={hintClass}>
                          {t('sendNote')}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="new-campaign-title" className={`${cardClass} flex flex-col gap-400`}>
        <h2 id="new-campaign-title" className={sectionTitle}>
          {t('newTitle')}
        </h2>
        <div className="grid gap-400 md:grid-cols-2">
          <FormField id="campaign-name" label={t('nameLabel')}>
            <input id="campaign-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField id="campaign-template" label={t('templateLabel')}>
            <select id="campaign-template" className={selectClass} value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
              {TEMPLATE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {tn(k)}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField id="campaign-description" label={t('descriptionLabel')} hint={t('descriptionHint')}>
          <input id="campaign-description" className={inputClass} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <div>
          <button type="button" className={buttonSecondary} disabled={busy || description.trim() === ''} onClick={suggest}>
            {busy ? t('suggesting') : t('suggest')}
          </button>
        </div>
        {problem ? (
          <p role="alert" className={errorNote}>
            {problem}
          </p>
        ) : null}
        {suggestion?.ok ? (
          <div role="status" className="flex flex-col gap-300 rounded-300 border border-border bg-bg-surface-subdued p-400">
            <p className="text-body-1 font-semibold text-text">{t('suggestion', { text: suggestion.text, count: suggestion.count })}</p>
            <p className={hintClass}>{t('suggestionNote')}</p>
            <div>
              <button type="button" className={buttonPrimary} disabled={busy || name.trim().length < 3} onClick={useRule}>
                {t('useRule')}
              </button>
            </div>
          </div>
        ) : null}
        {suggestion && !suggestion.ok ? (
          <div role="status" className="flex flex-col gap-200 rounded-300 border border-border bg-bg-surface-subdued p-400">
            <p className="text-body-2 font-semibold text-text">{t('unknownAudience')}</p>
            <p className={hintClass}>{suggestion.hint}</p>
            <p className="text-body-2 font-semibold text-text">{t('categoriesTitle')}</p>
            <ul className="flex flex-wrap gap-200">
              {suggestion.categories.map((c) => (
                <li key={c} className="rounded-100 bg-bg-surface px-200 py-050 text-caption-1 text-text">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
