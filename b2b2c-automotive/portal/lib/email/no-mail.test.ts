// "no mail code exists" (owner Q-P01, D8): W stores and previews templates and never sends. No provider env var and no send function
// exist anywhere in the portal; the module list of `lib/no-mail.test.ts` covers mail library imports.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    if (f === 'node_modules' || f === '.next') return [];
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const sources = ['app', 'lib', 'components', 'hooks', 'scripts'].flatMap((d) => walk(path.join(root, d))).filter((f) => /\.(ts|tsx|mjs)$/.test(f) && !/\.test\.(ts|tsx|mjs)$/.test(f));

describe('no mail code exists', () => {
  it('no provider environment variable is read anywhere', () => {
    const offenders = sources.filter((f) => /EMAIL_PROVIDER|SENDGRID|SMTP_|MAILGUN|RESEND_API|POSTMARK|SES_/.test(readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
  it('no send function or send route exists for templates and campaigns', () => {
    const offenders = sources
      .filter((f) => /seller[\\/](email|campaigns)|ct[\\/]seller[\\/]email|marketing[\\/]/.test(f))
      .filter((f) => /\b(sendEmail|sendCampaign|sendMail|queueEmail|outbox)\b/i.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
    expect(sources.some((f) => /seller[\\/]email[\\/].*send[\\/]route\.ts$/.test(f))).toBe(false);
  });
});
