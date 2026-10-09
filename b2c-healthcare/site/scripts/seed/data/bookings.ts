import type { Booking } from '../../../lib/clinical/types';
import { SAM } from './patients';

/** Sam's one past booking (completed). No slot claim: the slot is in the past. */
export const BOOKINGS: Booking[] = [
  {
    reference: 'BK-DEMO000001', requestId: 'seed-booking-sam-1', doctorKey: 'mlv-doc-amara-okafor', mode: 'office', startsAt: '2026-09-18T14:00:00.000Z',
    patientRef: SAM.patientRef, reason: 'Annual check-up', createdAt: '2026-09-10T15:30:00.000Z', status: 'completed',
  },
];
