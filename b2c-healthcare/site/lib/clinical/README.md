DEMO STAND-IN: this folder and `lib/ct/clinical-store.ts` imitate an electronic health record with commercetools Custom Objects; all data is synthetic and nothing here is a real clinical system.

# lib/clinical

- `types.ts` holds the record types and the three interfaces the rest of the app depends on: `PrescriptionSource`, `LabSource`, `CredentialSource`.
- `lib/ct/clinical-store.ts` (server-only) implements them on the containers `malva-rx`, `malva-lab` and `malva-credential`. A real scheduler or EHR replaces that file; callers do not change.
- Records link to a patient only through the opaque `patientRef` (`pt_<random>`, stored on the customer custom type `mlv-patient`), never through name or email.
- Health data rule: no RX number, lab value, reason for visit or booking detail goes into a URL, log line, analytics event or cache.
