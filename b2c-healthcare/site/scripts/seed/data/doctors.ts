import { CURRENCY, PREFIX } from '../lib';
import { specialtyCategoryKey } from './categories';
import { TAX_CONSULTATION } from './tax';
import { DOCTOR_PRODUCT_TYPE_KEY, L } from './types';

export type Mode = 'remote' | 'office';

/**
 * Fees in cents (the prototype's dollars x 100). A mode without a fee is not offered. Two doctors offer one mode only so the
 * disabled-mode behaviour of the booking panel can be checked: Dr. Tomás Alvarez is remote only, Dr. Leila Haddad is office only.
 */
export interface DoctorDef {
  slug: string;
  name: string;
  specialty: string;
  city: 'new-york' | 'austin' | 'chicago';
  timezone: string;
  yearsExperience: number;
  languages: string[];
  education: string;
  clinicName: string;
  bio: string;
  fees: Partial<Record<Mode, number>>;
}

export const DOCTORS: DoctorDef[] = [
  { slug: 'amara-okafor', name: 'Dr. Amara Okafor', specialty: 'general-practice', city: 'new-york', timezone: 'America/New_York', yearsExperience: 12, languages: ['English', 'Igbo'], education: 'MD, Johns Hopkins University', clinicName: 'Malva Clinic · Midtown', bio: 'Family doctor focused on preventive care, chronic condition management and same-day concerns such as infections, rashes and fatigue.', fees: { remote: 3500, office: 5500 } },
  { slug: 'daniel-reyes', name: 'Dr. Daniel Reyes', specialty: 'dermatology', city: 'new-york', timezone: 'America/New_York', yearsExperience: 9, languages: ['English', 'Spanish'], education: 'MD, NYU Grossman School of Medicine', clinicName: 'Skin & Co · Chelsea', bio: 'Treats acne, eczema, psoriasis and skin checks. Photo-based remote reviews are available before your session.', fees: { remote: 6000, office: 9000 } },
  { slug: 'priya-nair', name: 'Dr. Priya Nair', specialty: 'psychiatry', city: 'new-york', timezone: 'America/New_York', yearsExperience: 15, languages: ['English', 'Hindi', 'Malayalam'], education: 'MD, Columbia University', clinicName: 'Calm Practice · Brooklyn Heights', bio: 'Supports adults with anxiety, depression, ADHD and sleep problems through therapy and medication management.', fees: { remote: 7000, office: 11000 } },
  { slug: 'marcus-lee', name: 'Dr. Marcus Lee', specialty: 'pediatrics', city: 'austin', timezone: 'America/Chicago', yearsExperience: 11, languages: ['English', 'Mandarin'], education: 'MD, Baylor College of Medicine', clinicName: 'Little Steps Pediatrics · Austin', bio: 'Well-child visits, vaccinations, and care for common childhood illnesses, with calm, parent-friendly guidance.', fees: { remote: 4500, office: 7000 } },
  { slug: 'sofia-marchetti', name: 'Dr. Sofia Marchetti', specialty: 'cardiology', city: 'austin', timezone: 'America/Chicago', yearsExperience: 18, languages: ['English', 'Italian'], education: 'MD, University of Texas Southwestern', clinicName: 'Heartline Center · Austin', bio: 'Blood pressure, cholesterol, palpitations and long-term heart health, including review of lab and ECG results.', fees: { remote: 9500, office: 14000 } },
  { slug: 'james-whitfield', name: 'Dr. James Whitfield', specialty: 'orthopedics', city: 'chicago', timezone: 'America/Chicago', yearsExperience: 14, languages: ['English'], education: 'MD, Northwestern University', clinicName: 'MoveWell Ortho · Chicago', bio: 'Joint, back and sports injuries. Remote sessions cover imaging review and rehab planning.', fees: { remote: 8000, office: 12500 } },
  { slug: 'leila-haddad', name: 'Dr. Leila Haddad', specialty: 'gynecology', city: 'chicago', timezone: 'America/Chicago', yearsExperience: 10, languages: ['English', 'Arabic', 'French'], education: 'MD, University of Chicago', clinicName: 'Women’s Health Studio · Chicago', bio: 'Routine exams, contraception, pregnancy planning and menopause care in a private, unhurried setting.', fees: { office: 10000 } },
  { slug: 'tomas-alvarez', name: 'Dr. Tomás Alvarez', specialty: 'general-practice', city: 'austin', timezone: 'America/Chicago', yearsExperience: 7, languages: ['English', 'Spanish'], education: 'MD, University of Texas Health Science Center', clinicName: 'Malva Clinic · Austin Central', bio: 'Quick, practical primary care for adults, including travel health, sick notes and prescription renewals.', fees: { remote: 3000 } },
];

export const doctorKey = (d: DoctorDef) => `${PREFIX}doc-${d.slug}`;
export const doctorSku = (d: DoctorDef) => `DOC-${d.slug}`;
export const channelKey = (mode: Mode) => `${PREFIX}${mode}`;

export function doctorDraft(d: DoctorDef) {
  const modes = (Object.keys(d.fees) as Mode[]).filter((m) => d.fees[m] !== undefined);
  return {
    key: doctorKey(d),
    productType: { typeId: 'product-type', key: DOCTOR_PRODUCT_TYPE_KEY },
    name: L(d.name),
    slug: L(d.slug),
    description: L(d.bio),
    categories: [{ typeId: 'category', key: specialtyCategoryKey(d.specialty) }],
    taxCategory: { typeId: 'tax-category', key: TAX_CONSULTATION },
    masterVariant: {
      sku: doctorSku(d),
      key: doctorSku(d),
      attributes: [
        { name: 'specialty', value: d.specialty },
        { name: 'yearsExperience', value: d.yearsExperience },
        { name: 'languages', value: d.languages },
        { name: 'education', value: L(d.education) },
        { name: 'clinicName', value: d.clinicName },
        { name: 'city', value: d.city },
        { name: 'timezone', value: d.timezone },
        { name: 'modes', value: modes },
      ],
      prices: modes.map((m) => ({
        value: { currencyCode: CURRENCY, centAmount: d.fees[m] as number },
        channel: { typeId: 'channel', key: channelKey(m) },
      })),
    },
    publish: true,
  };
}
