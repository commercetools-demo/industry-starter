/**
 * Clinical stand-in types (demo stand-in for an EHR; see README.md). Pure types and interfaces: no server imports,
 * so components may import them. `patientRef` is an opaque per-project id (`pt_<random>`); records never carry name or email.
 */

import type { Mode } from './slots';

export type PatientRef = string;

export interface PrescriptionLine {
  lineRef: string;
  sku: string;
  name: string;
  sig: string;
  qty: number;
}

export interface Prescription {
  /** `RX-48213`; also the Custom Object key. */
  number: string;
  patientRef: PatientRef;
  prescriber: string;
  /** ISO date (`YYYY-MM-DD`). */
  issuedAt: string;
  refillsLeft: number;
  /** ISO date after which the prescription cannot be dispensed; absent means no expiry. */
  expiresAt?: string;
  lines: PrescriptionLine[];
}

export interface LabResult {
  name: string;
  value: number;
  unit: string;
  low: number;
  high: number;
}

export type LabStatus = 'ready' | 'processing';

export interface LabOrder {
  id: string;
  patientRef: PatientRef;
  name: string;
  /** ISO date. */
  collectedAt: string;
  status: LabStatus;
  orderedByDoctorKey: string;
  laboratory: string;
  note: string;
  results: LabResult[];
}

export type CredentialStatus = 'active' | 'expired' | 'revoked';

export interface Credential {
  patientRef: PatientRef;
  /** Controlled-substance class the credential covers, e.g. `schedule-iv`. */
  class: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  status: CredentialStatus;
}

export type BookingStatus = 'booked' | 'cancelled' | 'completed';

export interface GuestContact { name: string; email: string; phone: string }

/** `malva-booking` value (see lib/ct/bookings.ts). Bookings are Custom Objects, not Orders. */
export interface Booking {
  /** `BK-<base32>`; also the Custom Object key. Derived from the client `requestId`, so a retry finds the same booking. */
  reference: string;
  requestId: string;
  doctorKey: string;
  mode: Mode;
  /** UTC instant of the slot start. */
  startsAt: string;
  patientRef?: PatientRef;
  guest?: GuestContact;
  reason: string;
  createdAt: string;
  status: BookingStatus;
  /** Guest bookings only: after this instant the booking is no longer readable (and may be purged). */
  expiresAt?: string;
}

/** A real EHR would replace each source; callers depend only on these interfaces. */
export interface PrescriptionSource {
  listForPatient(patientRef: PatientRef): Promise<Prescription[]>;
  /** The caller must compare `patientRef` with the session's; an unknown number returns null. */
  getByNumber(number: string): Promise<Prescription | null>;
}

export interface LabSource {
  listForPatient(patientRef: PatientRef): Promise<LabOrder[]>;
  getById(id: string): Promise<LabOrder | null>;
}

export interface CredentialSource {
  listForPatient(patientRef: PatientRef): Promise<Credential[]>;
  get(patientRef: PatientRef, credentialClass: string): Promise<Credential | null>;
}

export const credentialKey = (patientRef: PatientRef, credentialClass: string): string => `${patientRef}.${credentialClass}`;
