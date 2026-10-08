import { PREFIX } from '../lib';

/** Synthetic demo patients; no real people. Emails use example.com and phone numbers the 555-01xx range. */
export interface PatientDef {
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Opaque per-project id stored on the customer (`mlv-patient.patientRef`); RX, labs and bookings link to it, never to name or email. */
  patientRef: string;
  fundingScheme?: string;
  address: { streetName: string; streetNumber: string; city: string; state: string; postalCode: string; phone: string };
}

export const SAM: PatientDef = {
  slug: 'sam-rivera', firstName: 'Sam', lastName: 'Rivera', email: 'sam.rivera@example.com', patientRef: 'pt_8k2m4q7x', fundingScheme: 'Demo Health Plan',
  address: { streetNumber: '12', streetName: 'Demo Street', city: 'New York', state: 'NY', postalCode: '10001', phone: '+1 212 555 0101' },
};
export const ALEX: PatientDef = {
  slug: 'alex-chen', firstName: 'Alex', lastName: 'Chen', email: 'alex.chen@example.com', patientRef: 'pt_3d9f6w2c',
  address: { streetNumber: '48', streetName: 'Sample Avenue', city: 'Austin', state: 'TX', postalCode: '78701', phone: '+1 512 555 0102' },
};
export const JORDAN: PatientDef = {
  slug: 'jordan-lee', firstName: 'Jordan', lastName: 'Lee', email: 'jordan.lee@example.com', patientRef: 'pt_7h5t1n8b',
  address: { streetNumber: '7', streetName: 'Example Road', city: 'Chicago', state: 'IL', postalCode: '60601', phone: '+1 312 555 0103' },
};

export const PATIENTS: PatientDef[] = [SAM, ALEX, JORDAN];

export const patientKey = (p: PatientDef) => `${PREFIX}patient-${p.slug}`;
export const PATIENT_TYPE_KEY = `${PREFIX}patient`;

/** Customer draft; the password comes from SEED_PATIENT_PASSWORD and is never stored in the repository. */
export function patientDraft(p: PatientDef, password: string) {
  return {
    key: patientKey(p),
    email: p.email,
    password,
    firstName: p.firstName,
    lastName: p.lastName,
    isEmailVerified: true,
    addresses: [{ key: `${PREFIX}home-${p.slug}`, country: 'US', firstName: p.firstName, lastName: p.lastName, ...p.address }],
    defaultShippingAddress: 0,
    defaultBillingAddress: 0,
    custom: {
      type: { typeId: 'type', key: PATIENT_TYPE_KEY },
      fields: { patientRef: p.patientRef, ...(p.fundingScheme ? { fundingScheme: p.fundingScheme } : {}) },
    },
  };
}
