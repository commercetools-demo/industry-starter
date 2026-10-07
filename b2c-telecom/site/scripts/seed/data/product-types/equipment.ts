import type { ProductTypeDraft } from '../../types';
import { own, shared } from '../shared/attributes';
import { EQUIPMENT_KIND, SUPPORTED_TECHNOLOGIES, WIFI_STANDARD } from '../shared/enums';

export const equipmentType: ProductTypeDraft = {
  key: 'malva-equipment',
  name: 'Malva equipment',
  description: 'Descriptive facts of routers, modems and gateways. Sold through offers (`malva-offer`).',
  attributes: [
    own('equipment-kind', 'Equipment kind', 'Geräteart', { name: 'enum', values: EQUIPMENT_KIND }, { isRequired: true, isSearchable: true }),
    own('max-downstream-mbps', 'Maximum downstream (Mbps)', 'Maximaler Download (Mbit/s)', { name: 'number' }, { isRequired: true, isSearchable: true }),
    own('supported-technologies', 'Supported technologies', 'Unterstützte Technologien', { name: 'set', elementType: { name: 'enum', values: SUPPORTED_TECHNOLOGIES } }, { isSearchable: true }),
    own('wifi-standard', 'Wi-Fi standard', 'WLAN-Standard', { name: 'enum', values: WIFI_STANDARD }, { isRequired: true }),
    // Planner default said `Unique`; the shared definition (constraint None) wins because one name has one definition.
    shared('charge-type', { isRequired: true }),
    own('incompatible-with', 'Incompatible with (offer keys)', 'Nicht kompatibel mit (Angebotsschlüssel)', { name: 'set', elementType: { name: 'text' } }),
    shared('highlights'),
  ],
};
