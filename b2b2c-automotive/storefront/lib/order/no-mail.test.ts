// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Owner decision Q-P01: no email, no SMS, ever. There is no mail connector, outbox or provider code, and no catalogue sentence promises one.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const walk = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' || e.name === '.next' ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)])) : [];
const isCode = (f: string) => /\.(tsx?|mjs|jsx?)$/.test(f) && !/\.test\./.test(f);

describe('no emails (owner decision Q-P01)', () => {
  it('there is no connectors directory and no mail connector', () => {
    expect(existsSync(path.resolve(root, '../connectors'))).toBe(false);
    expect(existsSync(path.resolve(root, 'connectors'))).toBe(false);
  });
  it('no mail, SMS or outbox code exists in the storefront', () => {
    const forbidden = /nodemailer|sendgrid|mailgun|postmark|@aws-sdk\/client-ses|smtp|outbox|order-mail-sender|sendMail|twilio|OrderCreated/i;
    const hits = ['app', 'components', 'hooks', 'lib', 'scripts'].flatMap((dir) => walk(path.join(root, dir))).filter(isCode).filter((f) => forbidden.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => path.relative(root, f))).toEqual([]);
  });
  it('no mail dependency is installed', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
    expect(Object.keys(pkg.dependencies ?? {}).filter((d) => /mail|sendgrid|twilio|ses$/.test(d))).toEqual([]);
  });
  it('no message promises an email or a text message', () => {
    for (const locale of ['en-US', 'de-DE']) {
      const catalogue = readFileSync(path.join(root, 'messages', `${locale}.json`), 'utf8');
      expect(catalogue).not.toMatch(/email you|text you|we.ll email|we.ll text|texted when|wir senden Ihnen eine (e-mail|sms)|per sms/i);
    }
  });
});
