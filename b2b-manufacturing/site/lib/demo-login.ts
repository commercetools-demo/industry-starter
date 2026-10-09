import 'server-only';

/** Sample customers of the seeded demo companies (seed/src, SEED_DEMO_PASSWORD). The password never leaves the server. */
export const DEMO_USERS = [
  { email: 'demo.admin@example.com', name: 'Dana Admin', company: 'Northfield Foods (demo)', role: 'Administrator' },
  { email: 'demo.site@example.com', name: 'Sam Site', company: 'Northfield Foods (demo)', role: 'Site contact' },
  { email: 'demo.finance@example.com', name: 'Fran Finance', company: 'Northfield Foods (demo)', role: 'Finance' },
  { email: 'other.admin@example.com', name: 'Olu Other', company: 'Riverside Care Group (demo)', role: 'Administrator' },
] as const;

type Env = Record<string, string | undefined>;

/** Demo sign-in exists only where `DEMO_LOGIN_PASSWORD` is set (local development, previews); leave it unset in production. */
export const demoPassword = (env: Env = process.env): string | null => env.DEMO_LOGIN_PASSWORD?.trim() || null;

export const demoUserByEmail = (email: string) => DEMO_USERS.find((u) => u.email === email);
