/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { checkMessages, usedKeys } from './check-messages.mjs';
import { appRoot, tmp } from './test-utils.mjs';

const cat = (o) => JSON.stringify(o);
const ok = { 'messages/de-DE.json': cat({ a: { b: 'Hallo {name}' } }), 'messages/en-US.json': cat({ a: { b: 'Hello {name}' } }) };

describe('check-messages', () => {
  it('Passes on the real catalogs', () => {
    expect(checkMessages(appRoot)).toEqual([]);
  });
  it('passes on matching catalogs', () => {
    expect(checkMessages(tmp(ok))).toEqual([]);
  });
  it('Catalogs with different keys fail', () => {
    const root = tmp({ ...ok, 'messages/de-DE.json': cat({ a: { b: 'Hallo {name}', c: 'extra' } }) });
    expect(checkMessages(root)).toContain('missing in en-US: a.c');
  });
  it('Third catalog fails', () => {
    const root = tmp({ ...ok, 'messages/fr-FR.json': cat({ a: { b: 'Salut {name}' } }) });
    expect(checkMessages(root).join('\n')).toMatch(/only de-DE and en-US catalogs are allowed/);
  });
  it('Used key missing in catalog fails', () => {
    const root = tmp({ ...ok, 'app/x.tsx': "const t = useTranslations('a'); t('zzz');" });
    expect(checkMessages(root).join('\n')).toMatch(/app\/x\.tsx uses missing message key a\.zzz/);
  });
  it('Empty value fails', () => {
    const root = tmp({ ...ok, 'messages/de-DE.json': cat({ a: { b: '' } }) });
    expect(checkMessages(root).join('\n')).toMatch(/empty value in de-DE: a\.b/);
  });
  it('Placeholder mismatch fails', () => {
    const root = tmp({ ...ok, 'messages/de-DE.json': cat({ a: { b: 'Hallo {store}' } }) });
    expect(checkMessages(root).join('\n')).toMatch(/placeholder mismatch for a\.b/);
  });
  it('Namespace translators are resolved', () => {
    expect(usedKeys("const t = useTranslations('errors'); t('genericTitle'); t.rich('genericBody')")).toEqual(['errors.genericTitle', 'errors.genericBody']);
    expect(usedKeys("const t = await getTranslations({ locale, namespace: 'common' }); t('appName')")).toEqual(['common.appName']);
  });
});
