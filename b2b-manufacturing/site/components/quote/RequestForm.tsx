'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuthActions } from '@/components/auth/useAuthActions';
import { Button, LinkButton } from '@/components/ui/Button';
import { OptionCard, Stepper } from '@/components/ui/content';
import { Field } from '@/components/ui/Field';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { useQuoteList } from '@/hooks/useQuoteList';
import { Link } from '@/i18n/routing';
import { SendError, sendJson } from '@/lib/fetcher';
import { CHOICES, COUNTRIES, HONEYPOT, SECTORS, SITE_COUNTS, WASTE_TYPES, type Choice } from '@/lib/quote/constants';
import { emptyFields, validateStep, type ErrorCode, type FieldErrors, type RequestFields } from '@/lib/quote/validation';
import { ROUTES } from '@/lib/site';
import { COUNTRY_CONFIG } from '@/lib/utils';
import { frequencyOptions, NoteInput } from './QuoteLines';
import { useLineEditor } from './useLineEditor';
import { useRequestContext } from './useRequestContext';
import './quote.css';

const DRAFT_KEY = 'malva-quote-draft';
type Status = 'idle' | 'submitting';
type Done = { reference: string; name: string; services: Array<{ serviceId: string; frequency?: string; note?: string }> };

const stepOfField = (field: string): 0 | 1 | 2 => (field === 'choice' ? 0 : ['contactName', 'jobTitle', 'email', 'phone', 'password'].includes(field) ? 2 : 1);

export function RequestForm() {
  const t = useTranslations('requestQuote');
  const locale = useLocale();
  const search = useSearchParams();
  const { list, isLoading: listLoading, update, reload } = useQuoteList();
  const { refreshAll } = useAuthActions();
  const { context, isLoading: contextLoading } = useRequestContext();
  const editor = useLineEditor();
  const country = COUNTRY_CONFIG[locale]?.country ?? 'US';

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [f, setF] = useState<RequestFields>(() => emptyFields(country));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [accountExists, setAccountExists] = useState(false);
  const [showChoice, setShowChoice] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [done, setDone] = useState<Done | null>(null);
  const [errorTick, setErrorTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const keyRef = useRef<string>('');
  const trapRef = useRef<HTMLInputElement>(null);
  const started = useRef({ draft: false, service: false, start: false, prefill: false, moved: false });

  const lines = list.lines;
  const hasServices = lines.some((l) => l.available !== false);
  const needsWaste = lines.some((l) => l.available !== false && l.needsWasteDetails);
  const signedIn = context.signedIn;
  const set = <K extends keyof RequestFields>(key: K, value: RequestFields[K]) => setF((prev) => ({ ...prev, [key]: value }));

  // Restore a draft kept while the visitor went to sign in (never the password).
  useEffect(() => {
    if (started.current.draft) return;
    started.current.draft = true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as { f?: Partial<RequestFields>; step?: 0 | 1 | 2 } | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the URL / sessionStorage, which only exist in the browser (the page shell is static)
      if (saved?.f) { setF((prev) => ({ ...prev, ...saved.f, password: '' })); setStep(saved.step ?? 0); started.current.moved = true; }
    } catch { /* no draft */ }
  }, []);
  useEffect(() => {
    if (!started.current.draft || done) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ f: { ...f, password: '' }, step })); } catch { /* storage is optional */ }
  }, [f, step, done]);

  // ?sector= preselects the sector (audience cards).
  useEffect(() => {
    const sector = search.get('sector');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the URL / sessionStorage, which only exist in the browser (the page shell is static)
    if (sector && (SECTORS as readonly string[]).includes(sector)) setF((prev) => (prev.sector ? prev : { ...prev, sector }));
  }, [search]);

  // ?service=<slug> adds that service to the list first (a second add changes nothing).
  useEffect(() => {
    const slug = search.get('service');
    if (!slug || started.current.service) return;
    started.current.service = true;
    update('POST', '/api/quote-list/lines', { serviceSlug: slug }).catch(() => undefined);
  }, [search, update]);

  // "Continue to request" from the list opens at the Site step.
  useEffect(() => {
    if (started.current.start || listLoading) return;
    started.current.start = true;
    if (search.get('from') === 'list' && list.count > 0 && !started.current.moved) setStep(1);
  }, [listLoading, list.count, search]);

  // Signed-in prefill: company, sector, first site, contact.
  useEffect(() => {
    if (started.current.prefill || contextLoading || !context.signedIn) return;
    started.current.prefill = true;
    const site = context.sites[0];
    setF((prev) => ({
      ...prev,
      company: prev.company || context.company || '', sector: prev.sector || context.sector || '',
      contactName: prev.contactName || context.contact?.name || '', jobTitle: prev.jobTitle || context.contact?.jobTitle || '', email: prev.email || context.contact?.email || '', phone: prev.phone || context.contact?.phone || '',
      ...(site && !prev.addressLine1 ? { siteId: site.id, addressLine1: site.addressLine1, addressLine2: site.addressLine2 ?? '', city: site.city, postalCode: site.postalCode, country: site.country } : {}),
    }));
  }, [contextLoading, context]);

  // Focus: the step heading after a step change, the first invalid field after a failed check.
  const firstRender = useRef(true);
  useEffect(() => { if (firstRender.current) { firstRender.current = false; return; } headingRef.current?.focus(); }, [step, done]);
  useEffect(() => { if (errorTick) (formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? formRef.current?.querySelector<HTMLElement>('fieldset input'))?.focus(); }, [errorTick]);

  const ctx = { hasServices, signedIn };
  const showErrors = (e: FieldErrors) => { setErrors(e); setErrorTick((n) => n + 1); };
  const errorText = (code?: ErrorCode) => (code ? t(`errors.${code}`) : undefined);

  function next() {
    const e = validateStep(step, f, ctx);
    if (Object.keys(e).length) { showErrors(e); setMessage(t('fixFields')); return; }
    setErrors({}); setMessage(''); setStep((step + 1) as 1 | 2);
  }
  function back() { setErrors({}); setMessage(''); setStep((step - 1) as 0 | 1); }

  function chooseSite(id: string) {
    if (id === '') { setF((prev) => ({ ...prev, siteId: '', addressLine1: '', addressLine2: '', city: '', postalCode: '' })); return; }
    const site = context.sites.find((s) => s.id === id);
    if (site) setF((prev) => ({ ...prev, siteId: id, addressLine1: site.addressLine1, addressLine2: site.addressLine2 ?? '', city: site.city, postalCode: site.postalCode, country: site.country }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step < 2) { next(); return; }
    if (status === 'submitting') return;
    for (const n of [0, 1, 2] as const) {
      const e = validateStep(n, f, ctx);
      if (Object.keys(e).length) { setStep(n); showErrors(e); setMessage(t('fixFields')); return; }
    }
    keyRef.current ||= crypto.randomUUID();
    setStatus('submitting'); setMessage(''); setAccountExists(false); setErrors({});
    const snapshot = lines.filter((l) => l.available !== false).map((l) => ({ serviceId: l.serviceId, frequency: l.frequency, note: l.note }));
    try {
      const body = { idempotencyKey: keyRef.current, locale, fields: { ...f, wasteTypes: needsWaste ? f.wasteTypes : [] }, [HONEYPOT]: trapRef.current?.value ?? '' };
      const result = await sendJson<{ reference: string }>('/api/quote-requests', 'POST', body);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setDone({ reference: result.reference, name: f.contactName, services: snapshot });
      await refreshAll();
      void reload();
    } catch (error) {
      if (error instanceof SendError) {
        const code = error.data.code;
        const fieldErrors = error.data.fieldErrors as FieldErrors | undefined;
        if (code === 'account-exists') { setAccountExists(true); setMessage(t('accountExists')); }
        else if (code === 'no-permission') setMessage(error.message);
        else if (fieldErrors && Object.keys(fieldErrors).length) { showErrors(fieldErrors); setMessage(t('fixFields')); setStep(stepOfField(Object.keys(fieldErrors)[0]!)); }
        else setMessage(error.status === 429 ? error.message : t('submitError'));
      } else setMessage(t('submitError'));
      setStatus('idle');
    }
  }

  async function addAnotherSite() {
    if (!done) return;
    for (const s of done.services) await update('POST', '/api/quote-list/lines', { serviceId: s.serviceId, ...(s.frequency ? { frequency: s.frequency } : {}), ...(s.note ? { note: s.note } : {}) }).catch(() => undefined);
    keyRef.current = '';
    setF((prev) => ({ ...prev, siteId: '', addressLine1: '', addressLine2: '', city: '', postalCode: '', siteCount: '', wasteTypes: [], permitNumber: '', need: '', password: '' }));
    setErrors({}); setMessage(''); setStatus('idle'); setDone(null); setStep(1);
  }

  const stepNames = [t('steps.service'), t('steps.site'), t('steps.contact')];
  const headings = [t('stepHeading.service'), t('stepHeading.site'), signedIn ? t('stepHeading.contact') : t('accountTitle')];

  if (done) {
    return (
      <div className="ok rq-done" data-testid="request-confirmation">
        <h2 ref={headingRef} tabIndex={-1}>{t('doneTitle')}</h2>
        <p role="status">{t('done', { name: done.name })}</p>
        <p className="rq-ref">{t('reference', { reference: done.reference })}</p>
        <div className="ql-actions">
          <LinkButton href={`${ROUTES.account}/quotes`}>{t('portalLink')}</LinkButton>
          <Button variant="outline" onClick={() => void addAnotherSite()}>{t('addSite')}</Button>
        </div>
      </div>
    );
  }

  const noPermission = signedIn && !context.canSubmit;
  const submitting = status === 'submitting';
  return (
    <form ref={formRef} className="rq-form" onSubmit={submit} noValidate aria-labelledby="rq-heading">
      <Stepper steps={stepNames} current={step} label={t('stepsLabel')} />
      <LiveRegion assertive>{message}</LiveRegion>
      <h2 id="rq-heading" ref={headingRef} tabIndex={-1}>{headings[step]}</h2>

      {step === 0 ? (
        <>
          {hasServices ? (
            <section aria-labelledby="rq-services" className="rq-lines">
              <h3 id="rq-services" style={{ font: '600 18px var(--font-display)' }}>{t('servicesTitle')}</h3>
              <p className="hint">{t('servicesHint')}</p>
              {lines.map((line) => (
                <div key={line.id} className="rq-line" data-testid="request-line">
                  <b>{line.name}</b>{line.available === false ? <span className="ql-flag">{t('unavailable')}</span> : null}
                  {line.available !== false ? (
                    <div className="row">
                      <label className="f"><span>{t('frequencyFor', { name: line.name })}</span>
                        <select value={line.frequency ?? ''} disabled={editor.busy} onChange={(e) => editor.onChange(line.id, { frequency: e.target.value })}>
                          <option value="">{t('frequencyNone')}</option>
                          {frequencyOptions(line).map((x) => <option key={x} value={x}>{t.has(`frequencies.${x}`) ? t(`frequencies.${x}`) : x}</option>)}
                        </select>
                      </label>
                      <NoteInput id={`rq-note-${line.id}`} line={line} label={t('noteFor', { name: line.name })} placeholder={t('noteFor', { name: line.name })} onSave={(note) => editor.onChange(line.id, { note })} />
                    </div>
                  ) : null}
                  <div><Button variant="outline" small disabled={editor.busy} aria-label={t('removeFor', { name: line.name })} onClick={() => editor.onRemove(line.id)}>{t('remove')}</Button></div>
                </div>
              ))}
              <div className="ql-actions">
                <LinkButton variant="outline" small href={ROUTES.plumbing}>{t('addService')}</LinkButton>
                <Button variant="outline" small aria-expanded={showChoice} onClick={() => setShowChoice((v) => !v)}>{t('notSure')}</Button>
              </div>
              {showChoice ? <p className="hint">{t('notSureHint')}</p> : null}
            </section>
          ) : null}
          {!hasServices || showChoice ? (
            <fieldset className="rq-opts" aria-describedby={errors.choice ? 'rq-choice-error' : undefined}>
              <legend>{t('choiceLegend')}</legend>
              {(CHOICES.filter((c) => c !== 'unsure') as Exclude<Choice, 'unsure'>[]).map((c) => (
                <OptionCard key={c} name="choice" value={c} checked={f.choice === c} onChange={(v) => set('choice', v as Choice)} title={t(`choice.${c}.title`)} body={t(`choice.${c}.body`)} />
              ))}
              {errors.choice ? <span id="rq-choice-error" role="alert" className="em">{errorText(errors.choice)}</span> : null}
            </fieldset>
          ) : null}
          <Field as="textarea" label={t('need')} placeholder={t('needPlaceholder')} value={f.need} onChange={(e) => set('need', e.target.value)} maxLength={1000} />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Field label={t('company')} name="company" autoComplete="organization" required value={f.company} readOnly={signedIn} onChange={(e) => set('company', e.target.value)} error={errorText(errors.company)} />
          <Field as="select" label={t('sector')} name="sector" required value={f.sector} onChange={(e) => set('sector', e.target.value)} error={errorText(errors.sector)}>
            <option value="" disabled>{t('sectorPlaceholder')}</option>
            {SECTORS.map((s) => <option key={s} value={s}>{t(`sectors.${s}`)}</option>)}
          </Field>
          {context.sites.length > 0 ? (
            <fieldset className="rq-opts">
              <legend>{t('sitesTitle')}</legend>
              {context.sites.map((s) => <OptionCard key={s.id} name="site" value={s.id} checked={f.siteId === s.id} onChange={chooseSite} title={s.label} body={s.postalCode} />)}
              <OptionCard name="site" value="" checked={f.siteId === ''} onChange={() => chooseSite('')} title={t('siteNew')} />
            </fieldset>
          ) : null}
          {f.siteId === '' ? (
            <>
              <Field label={t('address1')} name="addressLine1" autoComplete="address-line1" required value={f.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} error={errorText(errors.addressLine1)} />
              <Field label={t('address2')} name="addressLine2" autoComplete="address-line2" value={f.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} />
              <div className="grid g2" style={{ gap: 16 }}>
                <Field label={t('city')} name="city" autoComplete="address-level2" required value={f.city} onChange={(e) => set('city', e.target.value)} error={errorText(errors.city)} />
                <Field label={t('postalCode')} name="postalCode" autoComplete="postal-code" required value={f.postalCode} onChange={(e) => set('postalCode', e.target.value)} error={errorText(errors.postalCode)} />
              </div>
              <Field as="select" label={t('country')} name="country" autoComplete="country" value={f.country} onChange={(e) => set('country', e.target.value)}>
                {COUNTRIES.map((c) => <option key={c} value={c}>{t(`countries.${c}`)}</option>)}
              </Field>
            </>
          ) : null}
          <Field as="select" label={t('siteCount')} name="siteCount" required value={f.siteCount} onChange={(e) => set('siteCount', e.target.value)} error={errorText(errors.siteCount)}>
            <option value="" disabled>{t('siteCountPlaceholder')}</option>
            {SITE_COUNTS.map((c) => <option key={c} value={c}>{t(`siteCounts.${c}`)}</option>)}
          </Field>
          {needsWaste ? (
            <fieldset className="rq-opts" data-testid="waste-details">
              <legend>{t('wasteTitle')}</legend>
              <span className="hint">{t('wasteTypes')}</span>
              {WASTE_TYPES.map((w) => (
                <OptionCard key={w.key} type="checkbox" name="wasteTypes" value={w.key} checked={f.wasteTypes.includes(w.key)} title={t(`wasteType.${w.key}`)}
                  onChange={(v, on) => set('wasteTypes', on ? [...f.wasteTypes, v] : f.wasteTypes.filter((x) => x !== v))} />
              ))}
              <Field label={t('permit')} name="permitNumber" value={f.permitNumber} onChange={(e) => set('permitNumber', e.target.value)} />
            </fieldset>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          {!signedIn ? <><p>{t('accountBody')}</p></> : null}
          <Field label={t('contactName')} name="contactName" autoComplete="name" required value={f.contactName} onChange={(e) => set('contactName', e.target.value)} error={errorText(errors.contactName)} />
          <div className="grid g2" style={{ gap: 16 }}>
            <Field label={t('jobTitle')} name="jobTitle" autoComplete="organization-title" value={f.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} />
            <Field label={t('phone')} name="phone" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <Field label={t('email')} name="email" type="email" autoComplete="email" required value={f.email} readOnly={signedIn} onChange={(e) => set('email', e.target.value)} error={errorText(errors.email)} />
          {!signedIn ? <Field label={t('password')} name="password" type="password" autoComplete="new-password" required value={f.password} onChange={(e) => set('password', e.target.value)} hint={t('passwordHint')} error={errorText(errors.password)} /> : null}
          <div className="rq-trap" aria-hidden="true"><label>{t('honeypot')}<input ref={trapRef} type="text" name={HONEYPOT} tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>
          <p style={{ fontSize: 14, color: 'var(--fg2)' }}>{t('consent')} <Link href={ROUTES.privacy}>{t('privacy')}</Link></p>
          {!signedIn ? <p style={{ fontSize: 14 }}>{t('haveAccount')} <Link href={{ pathname: ROUTES.signIn, query: { next: ROUTES.quote } }}>{t('signIn')}</Link></p> : null}
        </>
      ) : null}

      {message ? (
        <p className="alert" role="presentation" data-testid="form-message">
          {message}{' '}
          {accountExists ? <Link href={{ pathname: ROUTES.signIn, query: { next: ROUTES.quote } }}>{t('accountExistsLink')}</Link> : null}
        </p>
      ) : null}
      {noPermission && step === 2 ? (
        <p className="alert" role="alert" data-testid="no-permission">{context.adminName ? t('noPermissionNamed', { name: context.adminName }) : t('noPermission')}</p>
      ) : null}

      <div className="ql-actions">
        {step > 0 ? <Button variant="outline" onClick={back} disabled={submitting}>{t('back')}</Button> : null}
        {step < 2 ? <Button type="button" onClick={next}>{t('continue')}</Button> : null}
        {step === 2 && !noPermission ? <Button type="submit" disabled={submitting} aria-disabled={submitting || undefined}>{submitting ? t('submitting') : signedIn ? t('submit') : t('submitAccount')}</Button> : null}
      </div>
    </form>
  );
}
