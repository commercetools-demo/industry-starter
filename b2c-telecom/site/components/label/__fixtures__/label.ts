import type { BroadbandLabelData } from '@/lib/types';

export const SAMPLE_LABEL: BroadbandLabelData = {
  id: 'MLV-CBL-500-24M',
  planName: 'Cable 500',
  kind: 'Cable internet',
  price: '$59.99',
  priceNote: 'Price locked for 24 months.',
  monthlyFees: [{ k: 'Router rental', v: '$8.00/mo' }],
  oneTime: [{ k: 'Activation fee', v: '$25.00' }],
  etf: '$10 x months remaining',
  discounts: '$5.00 off monthly when you add a phone plan.',
  speeds: [
    { k: 'Typical Download Speed', v: '525 Mbps' },
    { k: 'Typical Upload Speed', v: '48 Mbps' },
    { k: 'Typical Latency', v: '13 ms' },
  ],
  data: 'Unlimited',
};
