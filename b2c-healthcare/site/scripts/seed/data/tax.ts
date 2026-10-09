import { PREFIX } from '../lib';

export const TAX_RX_MEDICINE = `${PREFIX}rx-medicine`;
export const TAX_CONSULTATION = `${PREFIX}consultation`;

/** US 0%. `amount` is a fraction, so 0 means 0%; prices are tax-exclusive. */
const rate = () => ({ name: 'US sales tax (exempt)', amount: 0, includedInPrice: false, country: 'US' });

export const TAX_CATEGORIES = [
  { key: TAX_RX_MEDICINE, name: 'Prescription medicine', rates: [rate()] },
  { key: TAX_CONSULTATION, name: 'Consultation', rates: [rate()] },
];
