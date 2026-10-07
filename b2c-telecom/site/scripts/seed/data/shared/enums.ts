// Shared enum vocabulary (workstream G). Keys are English and stable; lenum labels carry both locales (D-004).
import type { LocalizedString } from '../catalog-types';

export interface LEnumValue {
  key: string;
  label: LocalizedString;
}
export interface PlainEnumValue {
  key: string;
  label: string;
}

const l = (key: string, en: string, de: string): LEnumValue => ({ key, label: { 'en-US': en, 'de-DE': de } });
const p = (key: string, label: string = key): PlainEnumValue => ({ key, label });

export const TECHNOLOGY: LEnumValue[] = [l('cable', 'Cable', 'Kabel'), l('fixed-wireless', 'Home wireless', 'Heim-Funk')];
export const CONTRACT_TERM: LEnumValue[] = [
  l('month-to-month', 'Month-to-month', 'Monatlich kündbar'),
  l('12-months', '12 months', '12 Monate'),
  l('24-months', '24 months', '24 Monate'),
];
export const CHARGE_TYPE: LEnumValue[] = [l('monthly', 'Monthly', 'Monatlich'), l('monthly-rental', 'Monthly rental', 'Monatliche Miete'), l('one-time', 'One-time', 'Einmalig')];
export const NETWORK_GENERATION: LEnumValue[] = [l('4g', 'LTE', 'LTE'), l('5g', '5G', '5G')];
export const BADGE: LEnumValue[] = [l('most-popular', 'Most popular', 'Am beliebtesten')];
export const ADDON_KIND: LEnumValue[] = [l('streaming', 'Streaming', 'Streaming'), l('security', 'Security', 'Sicherheit'), l('protection', 'Protection', 'Schutz')];
export const ADDON_TAG: LEnumValue[] = [l('music', 'Music', 'Musik'), l('video', 'Video', 'Video'), l('extras', 'Extras', 'Extras')];
export const COLOR: LEnumValue[] = [l('black', 'Black', 'Schwarz'), l('silver', 'Silver', 'Silber'), l('violet', 'Violet', 'Violett')];

export const MEMORY_GB: PlainEnumValue[] = [p('128', '128 GB'), p('256', '256 GB'), p('512', '512 GB')];
export const EQUIPMENT_KIND: PlainEnumValue[] = [p('router'), p('modem'), p('extender'), p('gateway')];
export const WIFI_STANDARD: PlainEnumValue[] = [p('none'), p('wifi-5'), p('wifi-6'), p('wifi-7')];
export const OS: PlainEnumValue[] = [p('android'), p('ios')];
export const OFFER_KIND: PlainEnumValue[] = [p('base-package'), p('addon'), p('equipment'), p('device'), p('bundle')];
export const EXISTING_CUSTOMER: PlainEnumValue[] = [p('any'), p('existing'), p('new')];
export const FAMILIES: PlainEnumValue[] = [p('internet'), p('phone')];
export const PHONE_FAMILY: PlainEnumValue[] = [p('phone')];
export const AUDIENCE: PlainEnumValue[] = [p('consumer'), p('small-business'), p('employee')];
export const REQUIRED_ADDON_KINDS: PlainEnumValue[] = [p('installation'), p('equipment')];
export const SUPPORTED_TECHNOLOGIES: PlainEnumValue[] = [p('cable'), p('fixed-wireless')];

export const OFFER_FAMILIES = ['cable', 'fixed-wireless', 'phone', 'addon', 'equipment', 'device'] as const;
export type OfferFamily = (typeof OFFER_FAMILIES)[number];
