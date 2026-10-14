// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkMessages, flatten, placeholders, usedKeys } from './check-messages.mjs';
import { tmpApp } from './test-utils.mjs';

const DE = '{"nav":{"home":"Start","hi":"Hallo {name}"}}';
const EN = '{"nav":{"home":"Home","hi":"Hello {name}"}}';
const base = { 'messages/de-DE.json': DE, 'messages/en-US.json': EN };

describe('Gates and tests: check-messages', () => {
  it('Passes on the real catalogs', () => {
    expect(checkMessages(process.cwd())).toEqual([]);
  });
  it('Catalogs with different keys fail', () => {
    const p = checkMessages(tmpApp({ 'messages/en-US.json': '{"a":"1","b":"2"}', 'messages/de-DE.json': '{"a":"1","c":"3"}' }));
    expect(p).toEqual(['missing in de-DE: b', 'missing in en-US: c']);
  });
  it('Third catalog fails', () => {
    const p = checkMessages(tmpApp({ ...base, 'messages/fr-FR.json': EN }));
    expect(p).toEqual(['messages/fr-FR.json is not allowed: only de-DE.json and en-US.json exist']);
  });
  it('a missing catalog fails', () => {
    expect(checkMessages(tmpApp({ 'messages/en-US.json': EN }))).toEqual(['messages/de-DE.json is missing']);
  });
  it('Used key missing in catalog fails', () => {
    expect(checkMessages(tmpApp({ ...base, 'app/p.tsx': "const t = useTranslations('nav'); t('home');" }))).toEqual([]);
    expect(checkMessages(tmpApp({ ...base, 'components/a.tsx': "const t = useTranslations('nav'); t('about');" }))).toEqual(['components/a.tsx uses missing message key nav.about']);
    expect(checkMessages(tmpApp({ ...base, 'lib/a.ts': "const t = await getTranslations({ namespace: 'nav' }); t('nope');" }))).toEqual(['lib/a.ts uses missing message key nav.nope']);
  });
  it('Empty value fails', () => {
    const p = checkMessages(tmpApp({ 'messages/de-DE.json': '{"a":""}', 'messages/en-US.json': '{"a":"x"}' }));
    expect(p).toEqual(['empty value in de-DE: a']);
  });
  it('Placeholder mismatch fails', () => {
    const p = checkMessages(tmpApp({ 'messages/de-DE.json': '{"a":"Shop {store}"}', 'messages/en-US.json': '{"a":"Shop {shop}"}' }));
    expect(p.join('\n')).toMatch(/placeholder mismatch for a/);
  });
  it('Namespace translators are resolved', () => {
    const src = "const t = useTranslations('nav'); const f = await getTranslations({ locale, namespace: 'footer.legal' });\n t('home'); t.rich('hi', {}); f('copy'); other('no');";
    expect(usedKeys(src)).toEqual(['nav.home', 'nav.hi', 'footer.legal.copy']);
  });
  it('flattens and reads ICU arguments', () => {
    expect(flatten({ a: { b: 'x', c: { d: 'y' } }, e: 'z' })).toEqual(['a.b', 'a.c.d', 'e']);
    expect(placeholders('{count, plural, one {# Teil} other {# Teile}} in {store}')).toEqual(['count', 'store']);
  });
});
