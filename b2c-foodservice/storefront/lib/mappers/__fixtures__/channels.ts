import type { Channel } from '@commercetools/platform-sdk';

const HOURS = JSON.stringify({
  mon: { open: '07:00', close: '18:00' },
  sun: null,
});

export function channelFixture(over: Partial<Channel> & { fields?: Record<string, unknown> } = {}): Channel {
  const { fields, ...rest } = over;
  return {
    id: 'ch-soho',
    version: 1,
    key: 'mcf-store-nyc-soho',
    roles: ['InventorySupply'],
    name: { 'en-US': 'Malva SoHo' },
    address: { country: 'US', city: 'New York', postalCode: '10012', streetName: 'Prince St', streetNumber: '1' },
    geoLocation: { type: 'Point', coordinates: [-74.003, 40.7233] },
    custom: {
      type: { typeId: 'type', id: 't' },
      fields: { addressLine: '1 Prince St', hours: HOURS, collectionMinutes: 15, ...fields },
    },
    createdAt: '',
    lastModifiedAt: '',
    ...rest,
  } as Channel;
}
