import { useLocale, useTranslations } from 'next-intl';
import { SampleMarker, Testimonial } from '@/components/ui/content';
import type { Accreditation, Testimonial as TestimonialItem } from '@/content/schema';
import { text } from '@/lib/content';
import { Sampled } from './Sampled';

/** Accreditations and testimonials on the wash band; each block, and the band itself, is omitted when empty. */
export function Proof({ accreditations, testimonials }: { accreditations: Accreditation[]; testimonials: TestimonialItem[] }) {
  const t = useTranslations('home');
  const c = useTranslations('content');
  const locale = useLocale();
  if (accreditations.length === 0 && testimonials.length === 0) return null;
  return (
    <section className="s g"><div className="wrap">
      <div className="sh"><div><h2>{t('certsTitle')}</h2></div></div>
      {accreditations.length > 0 ? (
        <div className="cert">
          {accreditations.map((item) => (
            <div key={item.id}>
              {text(item.title, locale)}<small>{text(item.caption, locale)}</small>
              {item.sample ? <span style={{ display: 'block', marginTop: 6 }}><SampleMarker label={c('sampleMarker')} /></span> : null}
            </div>
          ))}
        </div>
      ) : null}
      {testimonials.length > 0 ? (
        <div className="grid g3" style={accreditations.length > 0 ? { marginTop: 48 } : undefined}>
          {testimonials.map((item) => (
            <Sampled key={item.id} sample={item.sample}>
              <Testimonial quote={text(item.quote, locale)} role={text(item.role, locale)} org={text(item.org, locale)} />
            </Sampled>
          ))}
        </div>
      ) : null}
    </div></section>
  );
}
