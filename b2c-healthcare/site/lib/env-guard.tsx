import { CT_ENV_VARS } from '@/lib/env';

type EnvSource = Record<string, string | undefined>;

/**
 * Name of the first missing required variable, or null. Only ever answers in development: in
 * production (and tests) it returns null, so a response can never name a configuration variable.
 * Production misconfiguration fails fast at server start instead (`instrumentation.ts`).
 */
export function missingEnvInDev(env: EnvSource = process.env, nodeEnv: string | undefined = process.env.NODE_ENV): string | null {
  if (nodeEnv !== 'development') return null;
  for (const name of [...CT_ENV_VARS, 'SESSION_SECRET']) {
    if (!env[name]?.trim()) return name;
  }
  return null;
}

/** Plain, unstyled page for the root layout to return instead of the app while a variable is missing (development only). */
export function DevEnvErrorPage({ name }: { name: string }) {
  return (
    <html lang="en">
      <body>
        <main style={{ fontFamily: 'sans-serif', maxWidth: '40rem', margin: '4rem auto', padding: '0 1rem' }}>
          <h1>Missing environment variable</h1>
          <p>
            <code>{name}</code> is not set. Copy <code>.env.example</code> to <code>.env.local</code>, fill it in and
            restart the dev server.
          </p>
          <p>This page only appears in development.</p>
        </main>
      </body>
    </html>
  );
}
