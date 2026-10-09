/**
 * One-click sign-in for the three synthetic demo patients (scripts/seed/data/patients.ts) on the login page.
 * Off unless `DEMO_LOGIN_PASSWORD` is set (the same value as `SEED_PATIENT_PASSWORD` used when seeding). The password stays on the
 * server: the browser only sends the patient's slug to `POST /api/auth/demo-login`. Never set it on a real shop.
 */
export interface DemoPatient {
  slug: string;
  label: string;
  email: string;
}

export const DEMO_PATIENTS: readonly DemoPatient[] = [
  { slug: 'sam-rivera', label: 'Sam Rivera', email: 'sam.rivera@example.com' },
  { slug: 'alex-chen', label: 'Alex Chen', email: 'alex.chen@example.com' },
  { slug: 'jordan-lee', label: 'Jordan Lee', email: 'jordan.lee@example.com' },
];

export const demoPassword = (): string | null => {
  const value = process.env.DEMO_LOGIN_PASSWORD;
  return value && value.length >= 8 ? value : null;
};

export const demoLoginEnabled = (): boolean => demoPassword() !== null;

export const findDemoPatient = (slug: unknown): DemoPatient | undefined => DEMO_PATIENTS.find((p) => p.slug === slug);
