'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { EmailFrame, EmailText } from '@/components/email/EmailFrame';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, buttonSmall, cardClass, errorNote, hintClass, inputClass, sectionTitle, successNote } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { emailApi, type Brand, type CatalogResult, type TemplateView } from '@/hooks/marketingApi';

type Locale = 'de-DE' | 'en-US';
const LOCALES: Locale[] = ['de-DE', 'en-US'];
const VARIABLES = ['order_number', 'customer_name'] as const;
const PREVIEW_DELAY_MS = 300;

type Texts = Record<Locale, string>;
type Translate = (key: string, values?: Record<string, string>) => string;

/** The message of a failed save or preview: names the unknown variable; never shows the raw server text. */
export function templateErrorText(translate: Translate, result: CatalogResult<unknown>): string {
  if (result.status === 403) return translate('forbidden');
  if (result.code === 'UNKNOWN_VARIABLE') {
    const variable = result.details?.variable;
    return translate('unknownVariable', { variable: typeof variable === 'string' ? variable : '?' });
  }
  if (result.code === 'UNBALANCED_BRACES') return translate('unbalanced');
  if (result.code === 'TOO_LONG') return translate('tooLong');
  return translate('generic');
}

interface PreviewState {
  subject: Texts;
  html: Texts;
  brand: Brand;
}

/** One template: subject and body per language, variable buttons, an enabled switch, Save, and a live preview in the store's brand. */
export function TemplateEditor({ template, brand }: { template: TemplateView; brand: Brand }) {
  const t = useTranslations('email.editor');
  const tp = useTranslations('email.preview');
  const te = useTranslations('email.errors');
  const tn = useTranslations('email.templates.names');
  const { storeKey } = useViewer();
  const { toast } = useToast();
  const [locale, setLocale] = useState<Locale>('de-DE');
  const [subject, setSubject] = useState<Texts>({ ...template.subject });
  const [body, setBody] = useState<Texts>({ ...template.body });
  const [enabled, setEnabled] = useState(template.enabled);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<CatalogResult<unknown> | null>(null);
  const [previewProblem, setPreviewProblem] = useState<CatalogResult<unknown> | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<'subject' | 'body'>('body');

  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      const result = await emailApi.preview(storeKey, template.key, { subject, body });
      if (!current) return;
      if (result.ok && result.data) {
        setPreview({ subject: result.data.subject, html: result.data.html, brand: result.data.brand });
        setPreviewProblem(null);
      } else setPreviewProblem(result);
    }, PREVIEW_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [storeKey, template.key, subject, body]);

  function insert(variable: string) {
    const token = `{{${variable}}}`;
    const field = lastField.current;
    const element = field === 'subject' ? subjectRef.current : bodyRef.current;
    const set = field === 'subject' ? setSubject : setBody;
    const value = field === 'subject' ? subject[locale] : body[locale];
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? start;
    set((prev) => ({ ...prev, [locale]: value.slice(0, start) + token + value.slice(end) }));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    setSaving(true);
    setProblem(null);
    const result = await emailApi.save(storeKey, template.key, { subject, body, enabled });
    setSaving(false);
    if (!result.ok) return setProblem(result);
    toast(t('saved'));
  }

  const shown = preview?.brand ?? brand;
  return (
    <div className="grid gap-500 lg:grid-cols-2">
      <section aria-labelledby="editor-title" className={`${cardClass} flex flex-col gap-400`}>
        <h2 id="editor-title" className={sectionTitle}>
          {tn(template.key)}
        </h2>
        <div role="group" aria-label={t('language')} className="flex gap-200">
          {LOCALES.map((l) => (
            <button key={l} type="button" aria-pressed={locale === l} onClick={() => setLocale(l)} className={`${buttonSmall} ${locale === l ? 'bg-bg-surface-subdued' : ''}`}>
              {l}
            </button>
          ))}
        </div>
        <FormField id="email-subject" label={t('subject')}>
          <input
            id="email-subject"
            ref={subjectRef}
            className={inputClass}
            value={subject[locale]}
            onFocus={() => (lastField.current = 'subject')}
            onChange={(e) => setSubject((prev) => ({ ...prev, [locale]: e.target.value }))}
          />
        </FormField>
        <FormField id="email-body" label={t('body')}>
          <textarea
            id="email-body"
            ref={bodyRef}
            rows={8}
            className="w-full rounded-300 border border-border-input bg-bg-surface px-300 py-250 text-body-2 font-medium text-text focus-visible:outline-2 focus-visible:outline-border-active"
            value={body[locale]}
            onFocus={() => (lastField.current = 'body')}
            onChange={(e) => setBody((prev) => ({ ...prev, [locale]: e.target.value }))}
          />
        </FormField>
        <div className="flex flex-col gap-150">
          <p className={hintClass}>{t('insertHint')}</p>
          <div role="group" aria-label={t('insertVariable')} className="flex flex-wrap gap-200">
            {VARIABLES.map((v) => (
              <button key={v} type="button" onClick={() => insert(v)} className={buttonSmall}>
                {t('variableButton', { name: `{{${v}}}` })}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-200 text-body-2 font-semibold text-text">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-500 focus-visible:outline-2 focus-visible:outline-border-active" />
          {t('enabled')}
        </label>
        {problem ? (
          <p role="alert" className={errorNote}>
            {templateErrorText(te as Translate, problem)}
          </p>
        ) : null}
        <div>
          <button type="button" onClick={save} disabled={saving} className={buttonPrimary}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </section>
      <section aria-labelledby="preview-title" className={`${cardClass} flex flex-col gap-400`}>
        <h2 id="preview-title" className={sectionTitle}>
          {tp('title')}
        </h2>
        {previewProblem ? (
          <p role="alert" className={errorNote}>
            {templateErrorText(te as Translate, previewProblem)}
          </p>
        ) : null}
        {preview ? (
          <EmailFrame brand={shown}>
            <p className="mb-300 text-body-2 font-bold" aria-label={tp('subject')}>
              <EmailText html={escapeText(preview.subject[locale])} />
            </p>
            <p>
              <EmailText html={preview.html[locale]} />
            </p>
          </EmailFrame>
        ) : (
          <p className={successNote}>{tp('loading')}</p>
        )}
      </section>
    </div>
  );
}

/** The subject comes back as plain text; escape it so `EmailText` (which decodes entities) shows it unchanged. */
function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
