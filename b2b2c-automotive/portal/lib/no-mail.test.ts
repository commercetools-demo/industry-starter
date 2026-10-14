import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('no email is ever sent (owner Q-P01, D-034)', () => {
  it('no module under app/ or lib/ imports a mail provider', () => {
    const MAIL = /from\s+['"](nodemailer|@sendgrid\/[^'"]*|mailgun[^'"]*|@aws-sdk\/client-ses[^'"]*|resend|postmark|@\/lib\/mail[^'"]*|\.\/mail)['"]/;
    const offenders = ['app', 'lib', 'components', 'hooks']
      .flatMap((d) => walk(path.join(root, d)))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => MAIL.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
});
