import 'server-only';
import accreditationsJson from '@/content/accreditations.json';
import audiencesJson from '@/content/audiences.json';
import contactJson from '@/content/contact.json';
import { FILES, type Accreditation, type Audience, type Contact, type Localized, type Stat, type Testimonial } from '@/content/schema';
import statsJson from '@/content/stats.json';
import testimonialsJson from '@/content/testimonials.json';
import { DEFAULT_LOCALE } from '@/lib/utils';

/** Managed proof content (Q-010). An empty array means the section is omitted, never rendered empty. */
export const getStats = (): Stat[] => FILES.stats.parse(statsJson);
export const getAccreditations = (): Accreditation[] => FILES.accreditations.parse(accreditationsJson);
export const getTestimonials = (): Testimonial[] => FILES.testimonials.parse(testimonialsJson);
export const getAudiences = (): Audience[] => FILES.audiences.parse(audiencesJson);
export const getContact = (): Contact => FILES.contact.parse(contactJson);

/** Text for `locale`, falling back to the language, then en-US. */
export const text = (field: Localized, locale: string): string => field[locale] ?? field[Object.keys(field).find((k) => k.split('-')[0] === locale.split('-')[0]) ?? ''] ?? field[DEFAULT_LOCALE];
