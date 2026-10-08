// Shapes the account area passes between server code and components (workstream R). Types only.
import type { BookingStatus } from '@/lib/clinical/types';
import type { LabFlag } from '@/lib/labs';

/** One summary of the overview: it resolves on its own, so one failing service does not blank the page. */
export type Section<T> = { status: 'ok'; data: T } | { status: 'error' };

export interface LabListItem {
  id: string;
  name: string;
  /** ISO date. */
  collectedAt: string;
  laboratory: string;
  status: 'ready' | 'processing';
}

export interface Overview {
  user: Section<{ firstName?: string; email: string }>;
  labs: Section<{ ready: number; latest: LabListItem[] }>;
  appointments: Section<{ upcoming: number }>;
  orders: Section<{ count: number }>;
}

export interface LabResultView {
  name: string;
  value: number;
  unit: string;
  low: number;
  high: number;
  flag: LabFlag;
}

export interface LabDetailView extends LabListItem {
  note: string;
  orderedByDoctorKey: string;
  /** Display name of the ordering doctor; empty when it cannot be resolved. */
  orderedByName: string;
  results: LabResultView[];
}

export interface AppointmentView {
  reference: string;
  doctorKey: string;
  /** Empty when the doctor cannot be resolved. */
  doctorName: string;
  mode: 'remote' | 'office';
  clinicName: string;
  startsAt: string;
  /** IANA zone the date and time are shown in (the clinic's). */
  timezone: string;
  status: BookingStatus;
  /** Upcoming, still booked, and at least 2 h away. */
  canCancel: boolean;
}

export interface AppointmentsView {
  upcoming: AppointmentView[];
  past: AppointmentView[];
}
