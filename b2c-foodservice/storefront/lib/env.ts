import 'server-only';

export interface ServerEnv {
  CTP_PROJECT_KEY: string;
  CTP_CLIENT_ID: string;
  CTP_CLIENT_SECRET: string;
  CTP_AUTH_URL: string;
  CTP_API_URL: string;
  CTP_SCOPES: string;
  SESSION_SECRET: string;
  EXPECTED_PROJECT_KEY: string;
}

/** Thrown for any invalid environment. The message names the variable, never its value
 *  (project keys are not secrets and are named by the project guard). */
export class EnvError extends Error {
  readonly variable: string;
  constructor(variable: string, message: string) {
    super(message);
    this.name = 'EnvError';
    this.variable = variable;
  }
}

const REQUIRED = [
  'CTP_PROJECT_KEY',
  'CTP_CLIENT_ID',
  'CTP_CLIENT_SECRET',
  'CTP_AUTH_URL',
  'CTP_API_URL',
  'CTP_SCOPES',
  'SESSION_SECRET',
  'EXPECTED_PROJECT_KEY',
] as const;

const PUBLIC_FORBIDDEN = ['SECRET', 'CLIENT_ID', 'SCOPES'];

function normaliseUrl(name: string, value: string): string {
  if (!value.startsWith('https://')) {
    throw new EnvError(name, `${name} must start with https://`);
  }
  return value.replace(/\/+$/, '');
}

export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  for (const name of Object.keys(source)) {
    if (name.startsWith('NEXT_PUBLIC_') && PUBLIC_FORBIDDEN.some((part) => name.includes(part))) {
      throw new EnvError(name, `${name} must not be public`);
    }
  }

  const values = {} as Record<(typeof REQUIRED)[number], string>;
  for (const name of REQUIRED) {
    const value = source[name]?.trim();
    if (!value) throw new EnvError(name, `Missing environment variable ${name}`);
    values[name] = value;
  }

  if (values.SESSION_SECRET.length < 32) {
    throw new EnvError('SESSION_SECRET', 'SESSION_SECRET must be at least 32 characters');
  }

  values.CTP_AUTH_URL = normaliseUrl('CTP_AUTH_URL', values.CTP_AUTH_URL);
  values.CTP_API_URL = normaliseUrl('CTP_API_URL', values.CTP_API_URL);

  if (values.CTP_PROJECT_KEY !== values.EXPECTED_PROJECT_KEY) {
    throw new EnvError(
      'CTP_PROJECT_KEY',
      `Wrong commercetools project: CTP_PROJECT_KEY="${values.CTP_PROJECT_KEY}" but EXPECTED_PROJECT_KEY="${values.EXPECTED_PROJECT_KEY}"`,
    );
  }

  return values;
}

let cached: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  cached ??= parseEnv(process.env);
  return cached;
}
