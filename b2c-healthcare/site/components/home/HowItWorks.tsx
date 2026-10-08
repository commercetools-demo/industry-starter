import { useTranslations } from 'next-intl';

export const STEP_KEYS = ['one', 'two', 'three', 'four'] as const;

/** Four numbered steps (44 px navy circles). An ordered list, so the numbers are real list semantics. */
export function HowItWorks() {
  const t = useTranslations('home.steps');
  return (
    <section aria-labelledby="home-steps-title" className="bg-surface-subtle py-22">
      <div className="mx-auto max-w-content px-5 nav:px-8">
        <h2 id="home-steps-title" className="mb-10 font-display text-[length:clamp(1.625rem,3.4vw,2.25rem)] leading-tight font-semibold text-text-heading">
          {t('title')}
        </h2>
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,13.75rem),1fr))] gap-8 p-0">
          {STEP_KEYS.map((key, index) => (
            <li key={key}>
              <span aria-hidden="true" className="mb-4 grid size-11 place-items-center rounded-full bg-navy-700 font-display font-semibold text-text-on-brand">
                {index + 1}
              </span>
              <h3 className="font-display text-lg font-semibold text-text-heading">{t(`${key}.title`)}</h3>
              <p className="mt-1.5 text-sm">{t(`${key}.text`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
