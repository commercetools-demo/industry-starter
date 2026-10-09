import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';
import { config as refillConfig } from './netlify/functions/auto-refill-run';
import { config as reloadConfig } from './netlify/functions/reload-allowances-scheduled';
import { config as retentionConfig } from './netlify/functions/retention-scheduled';

interface Toml {
  build: { command: string; environment?: unknown };
  functions: Record<string, unknown> & { directory: string };
  headers: Array<{ for: string; values: Record<string, string> }>;
}

const toml = parse(readFileSync(resolve(import.meta.dirname, 'netlify.toml'), 'utf8')) as unknown as Toml;
const headersFor = (path: string) => toml.headers.find((h) => h.for === path)?.values ?? {};
const csp = headersFor('/*')['Content-Security-Policy'] ?? '';

describe('netlify.toml', () => {
  it('parses and builds with the verifying build command', () => {
    expect(toml.build.command).toBe('npm run verify:build');
    expect(toml.functions.directory).toBe('netlify/functions');
  });

  it('declares the same cron as each scheduled function exports', () => {
    const fn = toml.functions as Record<string, { schedule?: string }>;
    expect(fn['auto-refill-run']?.schedule).toBe(refillConfig.schedule);
    expect(fn['reload-allowances-scheduled']?.schedule).toBe(reloadConfig.schedule);
    expect(fn['retention-scheduled']?.schedule).toBe(retentionConfig.schedule);
  });

  it('sets the baseline security headers for every path', () => {
    const values = headersFor('/*');
    expect(values['X-Content-Type-Options']).toBe('nosniff');
    expect(values['Referrer-Policy']).toBe('same-origin');
    expect(values['X-Frame-Options']).toBe('DENY');
  });

  it('CSP allows Stripe, and commercetools Checkout, and nothing wildcard-wide', () => {
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src[^;]*https:\/\/js\.stripe\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/\*\.commercetools\.com/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.commercetools\.com/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/(^|[ ;])\*([ ;]|$)/);
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('never caches patient data', () => {
    expect(headersFor('/api/account/*')['Cache-Control']).toBe('no-store');
    expect(headersFor('/*/account/*')['Cache-Control']).toBe('no-store');
    expect(headersFor('/*/prescriptions')['Cache-Control']).toContain('no-store');
  });

  it('holds no secret value', () => {
    const text = readFileSync(resolve(import.meta.dirname, 'netlify.toml'), 'utf8');
    expect(text).not.toMatch(/SECRET\s*=|CTP_[A-Z_]+\s*=/);
  });
});
