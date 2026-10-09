import type { Price, ProductProjection } from '@commercetools/platform-sdk';
import type { ConsultationMode, Doctor, DoctorCard, Money } from '@/lib/types';
import { attrEnumKey, attrNumber, attrSet, attrText, findAttribute } from '@/lib/mappers/attributes';
import { getLocalizedString } from '@/lib/utils';

/** Price channel key per consultation mode. */
export const MODE_CHANNEL_KEYS: Record<ConsultationMode, string> = {
  remote: 'mlv-remote',
  office: 'mlv-office',
};

const MODES = Object.keys(MODE_CHANNEL_KEYS) as ConsultationMode[];

export interface DoctorMapOptions {
  locale: string;
  currency: string;
  /** Optional channel id -> key map for projections whose price channels are not expanded. */
  channelKeysById?: Record<string, string>;
}

/** "Dr. Amara Okafor" -> "AO" (leading "Dr." dropped, first two words). */
export function initialsOf(name: string): string {
  return name
    .replace(/^Dr\.?\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => Array.from(word)[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function channelKey(price: Price, options: DoctorMapOptions): string | undefined {
  const channel = price.channel;
  if (!channel) return undefined;
  return channel.obj?.key ?? options.channelKeysById?.[channel.id];
}

/** Fee per mode: the price in the visitor's currency on the mode's channel. A mode without a price is not offered. */
export function mapDoctorFees(prices: Price[] | undefined, options: DoctorMapOptions): Partial<Record<ConsultationMode, Money>> {
  const fees: Partial<Record<ConsultationMode, Money>> = {};
  for (const price of prices ?? []) {
    if (price.value.currencyCode !== options.currency) continue;
    const key = channelKey(price, options);
    const mode = MODES.find((m) => MODE_CHANNEL_KEYS[m] === key);
    if (mode && !fees[mode]) {
      fees[mode] = {
        centAmount: price.value.centAmount,
        currencyCode: price.value.currencyCode,
        fractionDigits: price.value.fractionDigits,
      };
    }
  }
  return fees;
}

function mapModes(attributeValue: unknown, fees: Partial<Record<ConsultationMode, Money>>): ConsultationMode[] {
  const declared = attrSet(attributeValue, 'en', true).filter((m): m is ConsultationMode => m === 'remote' || m === 'office');
  const modes = declared.length > 0 ? declared : MODES.filter((m) => fees[m]);
  return MODES.filter((m) => modes.includes(m));
}

export function mapDoctorCard(projection: ProductProjection, options: DoctorMapOptions): DoctorCard {
  const { locale } = options;
  const attributes = projection.masterVariant.attributes;
  const name = getLocalizedString(projection.name, locale);
  const fees = mapDoctorFees(projection.masterVariant.prices, options);
  const stats = projection.reviewRatingStatistics;
  const specialty = findAttribute(attributes, 'specialty');
  return {
    id: projection.id,
    key: projection.key ?? projection.id,
    slug: getLocalizedString(projection.slug, locale),
    name,
    specialty: attrText(specialty, locale),
    specialtyKey: attrEnumKey(specialty),
    yearsExperience: attrNumber(findAttribute(attributes, 'yearsExperience')) ?? 0,
    clinicName: attrText(findAttribute(attributes, 'clinicName'), locale),
    city: attrText(findAttribute(attributes, 'city'), locale),
    modes: mapModes(findAttribute(attributes, 'modes'), fees),
    fees,
    rating: stats && stats.count > 0 ? Math.round(stats.averageRating * 10) / 10 : null,
    reviewCount: stats?.count ?? 0,
    initials: initialsOf(name),
    portraitUrl: projection.masterVariant.images?.[0]?.url ?? null,
    sellableInRegion: Object.keys(fees).length > 0,
  };
}

export function mapDoctor(projection: ProductProjection, options: DoctorMapOptions): Doctor {
  const { locale } = options;
  const attributes = projection.masterVariant.attributes;
  return {
    ...mapDoctorCard(projection, options),
    bio: getLocalizedString(projection.description, locale),
    languages: attrSet(findAttribute(attributes, 'languages'), locale),
    education: attrText(findAttribute(attributes, 'education'), locale),
    timezone: attrText(findAttribute(attributes, 'timezone'), locale),
  };
}
