import 'server-only';
import { CONTAINERS, getObject, queryObjects } from '@/lib/ct/custom-objects';
import { credentialKey, type Credential, type CredentialSource, type LabOrder, type LabSource, type Prescription, type PrescriptionSource } from '@/lib/clinical/types';

/** Demo stand-in for an EHR (see lib/clinical/README.md): Custom Object implementations of the clinical sources. */

const byPatient = (patientRef: string) => `value(patientRef="${patientRef.replace(/[^\w-]/g, '')}")`;

export const prescriptionSource: PrescriptionSource = {
  async listForPatient(patientRef) {
    const all = await queryObjects<Prescription>(CONTAINERS.rx, byPatient(patientRef));
    return all.map((o) => o.value).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  },
  async getByNumber(number) {
    return (await getObject<Prescription>(CONTAINERS.rx, number))?.value ?? null;
  },
};

export const labSource: LabSource = {
  async listForPatient(patientRef) {
    const all = await queryObjects<LabOrder>(CONTAINERS.lab, byPatient(patientRef));
    return all.map((o) => o.value).sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  },
  async getById(id) {
    return (await getObject<LabOrder>(CONTAINERS.lab, id))?.value ?? null;
  },
};

export const credentialSource: CredentialSource = {
  async listForPatient(patientRef) {
    return (await queryObjects<Credential>(CONTAINERS.credential, byPatient(patientRef))).map((o) => o.value);
  },
  async get(patientRef, credentialClass) {
    return (await getObject<Credential>(CONTAINERS.credential, credentialKey(patientRef, credentialClass)))?.value ?? null;
  },
};
