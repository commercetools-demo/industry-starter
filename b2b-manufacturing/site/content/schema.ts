import { z } from 'zod';

/** Text that exists per locale; `en-US` is required and is the fallback. */
export const localized = z.object({ 'en-US': z.string().min(1) }).catchall(z.string());
const base = { id: z.string().min(1), sample: z.boolean() };

export const statSchema = z.object({ ...base, value: z.string().min(1), caption: localized });
export const accreditationSchema = z.object({ ...base, title: localized, caption: localized });
export const testimonialSchema = z.object({ ...base, quote: localized, role: localized, org: localized });
export const SECTORS = ['facilities', 'manufacturing', 'property', 'healthcare'] as const;
export const audienceSchema = z.object({ ...base, sector: z.enum(SECTORS), title: localized, body: localized });
const phone = z.object({ display: z.string().min(1), href: z.string().regex(/^tel:\+?\d+$/) });
export const contactSchema = z.object({ emergency: phone, commercial: phone, email: z.string().email(), hours: localized, sample: z.boolean() });

export type Localized = z.infer<typeof localized>;
export type Stat = z.infer<typeof statSchema>;
export type Accreditation = z.infer<typeof accreditationSchema>;
export type Testimonial = z.infer<typeof testimonialSchema>;
export type Audience = z.infer<typeof audienceSchema>;
export type Contact = z.infer<typeof contactSchema>;

/** Every content file with the schema that validates it (used by lib/content.ts and the launch check). */
export const FILES = {
  stats: z.array(statSchema),
  accreditations: z.array(accreditationSchema),
  testimonials: z.array(testimonialSchema),
  audiences: z.array(audienceSchema),
  contact: contactSchema,
} as const;
