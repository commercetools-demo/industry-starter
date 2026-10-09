import type { ProductProjection } from '@commercetools/platform-sdk';
import { describe, expect, it } from 'vitest';
import { formatMoney } from '@/lib/utils';
import { initialsOf, mapDoctor, mapDoctorCard, mapDoctorFees } from './doctor';
import { mapMedication } from './medication';

const usd = (centAmount: number) => ({ type: 'centPrecision', centAmount, currencyCode: 'USD', fractionDigits: 2 });
const channel = (key: string) => ({ typeId: 'channel', id: `id-${key}`, obj: { key } });

// Fixtures follow the seed data model (product types mlv-doctor / mlv-medication, price channels).
const doctor = {
  id: 'p-okafor',
  key: 'mlv-doc-okafor',
  name: { 'en-US': 'Dr. Amara Okafor' },
  slug: { 'en-US': 'amara-okafor' },
  description: { 'en-US': 'Family doctor.' },
  reviewRatingStatistics: { averageRating: 4.9333, highestRating: 5, lowestRating: 4, count: 312, ratingsDistribution: {} },
  categories: [],
  masterVariant: {
    id: 1,
    sku: 'DOC-okafor',
    images: [{ url: 'https://images.pexels.com/photos/1/p.jpeg', dimensions: { w: 1, h: 1 } }],
    prices: [
      { id: 'a', value: usd(3500), channel: channel('mlv-remote') },
      { id: 'b', value: usd(5500), channel: channel('mlv-office') },
      { id: 'c', value: { type: 'centPrecision', centAmount: 3000, currencyCode: 'EUR', fractionDigits: 2 }, channel: channel('mlv-remote') },
    ],
    attributes: [
      { name: 'specialty', value: { key: 'general-practice', label: 'General Practice' } },
      { name: 'yearsExperience', value: 12 },
      { name: 'languages', value: ['English', 'Igbo'] },
      { name: 'education', value: { 'en-US': 'MD, Johns Hopkins University' } },
      { name: 'clinicName', value: 'Malva Clinic · Midtown' },
      { name: 'city', value: { key: 'new-york', label: 'New York' } },
      { name: 'timezone', value: 'America/New_York' },
      { name: 'modes', value: [{ key: 'remote', label: 'Remote' }, { key: 'office', label: 'Office' }] },
    ],
  },
} as unknown as ProductProjection;

const options = { locale: 'en-US', currency: 'USD' };

describe('storefront-data-loading: doctor mapper', () => {
  it('maps attributes, fee per mode from channel prices, rating from statistics, initials and portrait', () => {
    const d = mapDoctor(doctor, options);
    expect(d).toMatchObject({
      id: 'p-okafor',
      key: 'mlv-doc-okafor',
      slug: 'amara-okafor',
      name: 'Dr. Amara Okafor',
      specialty: 'General Practice',
      specialtyKey: 'general-practice',
      yearsExperience: 12,
      clinicName: 'Malva Clinic · Midtown',
      city: 'New York',
      modes: ['remote', 'office'],
      rating: 4.9,
      reviewCount: 312,
      initials: 'AO',
      portraitUrl: 'https://images.pexels.com/photos/1/p.jpeg',
      bio: 'Family doctor.',
      languages: ['English', 'Igbo'],
      education: 'MD, Johns Hopkins University',
      timezone: 'America/New_York',
    });
    expect(d.fees.remote).toEqual({ centAmount: 3500, currencyCode: 'USD', fractionDigits: 2 });
    expect(d.fees.office?.centAmount).toBe(5500);
    expect(formatMoney(d.fees.remote!.centAmount, 'USD', 'en-US')).toBe('$35.00');
  });

  it('a card carries no profile-only fields and survives serialization', () => {
    const card = mapDoctorCard(doctor, options);
    expect(card).not.toHaveProperty('bio');
    expect(JSON.parse(JSON.stringify(card))).toEqual(card);
  });

  it('a doctor offering one mode has one fee and one mode; no reviews means null rating, no image means null portrait', () => {
    const remoteOnly = {
      ...doctor,
      reviewRatingStatistics: undefined,
      masterVariant: {
        ...doctor.masterVariant,
        images: [],
        prices: [(doctor.masterVariant.prices ?? [])[0]],
        attributes: (doctor.masterVariant.attributes ?? []).filter((a) => a.name !== 'modes'),
      },
    } as unknown as ProductProjection;
    const d = mapDoctorCard(remoteOnly, options);
    expect(d.modes).toEqual(['remote']);
    expect(Object.keys(d.fees)).toEqual(['remote']);
    expect(d.rating).toBeNull();
    expect(d.reviewCount).toBe(0);
    expect(d.portraitUrl).toBeNull();
  });

  it('channel keys can come from an id map when the channel is not expanded', () => {
    const prices = [{ id: 'a', value: usd(100), channel: { typeId: 'channel', id: 'ch-1' } }] as never;
    expect(mapDoctorFees(prices, { ...options, channelKeysById: { 'ch-1': 'mlv-office' } })).toEqual({
      office: { centAmount: 100, currencyCode: 'USD', fractionDigits: 2 },
    });
    expect(mapDoctorFees(prices, options)).toEqual({});
  });

  it('initials: drops Dr., takes two letters, handles accents', () => {
    expect(initialsOf('Dr. Tomás Alvarez')).toBe('TA');
    expect(initialsOf('Dr Priya Nair')).toBe('PN');
    expect(initialsOf('Madonna')).toBe('M');
  });
});

const medication = {
  id: 'p-amox',
  key: 'mlv-med-amoxicillin-500',
  name: { 'en-US': 'Amoxicillin 500 mg' },
  slug: { 'en-US': 'amoxicillin-500-mg' },
  description: { 'en-US': 'Antibiotic.' },
  categories: [{ typeId: 'category', id: 'cat-antibiotics' }],
  masterVariant: {
    id: 1,
    sku: 'MED-amoxicillin-500',
    images: [{ url: 'https://images.pexels.com/photos/2/m.jpeg', dimensions: { w: 1, h: 1 } }],
    prices: [{ id: 'p', value: usd(1450) }],
    attributes: [
      { name: 'strength', value: '500 mg' },
      { name: 'dosageForm', value: { key: 'capsule', label: 'Capsule' } },
      { name: 'rxOnly', value: true },
      { name: 'dispenseUnit', value: '21 capsules' },
      { name: 'minRemainingShelfLifeDays', value: 90 },
      { name: 'maxQtyPerOrder', value: 2 },
      { name: 'hsaEligible', value: true },
      { name: 'controlClass', value: { key: 'none', label: 'None' } },
    ],
  },
} as unknown as ProductProjection;

describe('storefront-data-loading: medication mapper', () => {
  it('maps attributes, pack price and image', () => {
    const m = mapMedication(medication, options);
    expect(m).toMatchObject({
      key: 'mlv-med-amoxicillin-500',
      name: 'Amoxicillin 500 mg',
      sku: 'MED-amoxicillin-500',
      strength: '500 mg',
      dosageForm: 'Capsule',
      rxOnly: true,
      dispenseUnit: '21 capsules',
      minRemainingShelfLifeDays: 90,
      maxQtyPerOrder: 2,
      hsaEligible: true,
      controlClass: null,
      imageUrl: 'https://images.pexels.com/photos/2/m.jpeg',
      categoryIds: ['cat-antibiotics'],
    });
    expect(m.price).toEqual({ centAmount: 1450, currencyCode: 'USD', fractionDigits: 2 });
    expect(formatMoney(m.price!.centAmount, 'USD', 'en-US')).toBe('$14.50');
  });

  it('no price in the currency and missing attributes degrade to null/defaults', () => {
    const m = mapMedication({ ...medication, masterVariant: { id: 1, prices: [], attributes: [] } } as unknown as ProductProjection, options);
    expect(m.price).toBeNull();
    expect(m.rxOnly).toBe(false);
    expect(m.maxQtyPerOrder).toBeNull();
    expect(m.imageUrl).toBeNull();
  });
});
