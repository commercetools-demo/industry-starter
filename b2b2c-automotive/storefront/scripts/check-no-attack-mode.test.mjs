/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkNoAttackMode } from './check-no-attack-mode.mjs';
import path from 'node:path';
import { tmpApp as tmp } from './test-utils.mjs';

const appRoot = path.resolve(import.meta.dirname, '..');

describe('check-no-attack-mode', () => {
  it('a netlify.toml with ATTACK_MODE=1 fails', () => {
    const root = tmp({ 'netlify.toml': '[build.environment]\n  ATTACK_MODE = "1"\n' });
    expect(checkNoAttackMode(root, {}).join('\n')).toMatch(/netlify\.toml mentions ATTACK_MODE/);
  });
  it('the canary in vercel.json, .env.production or next.config fails', () => {
    for (const file of ['vercel.json', '.env.production', 'next.config.ts']) {
      expect(checkNoAttackMode(tmp({ [file]: 'CONTENTOOLS_JWT_CANARY=x' }), {})).toHaveLength(1);
    }
  });
  it('.env.example may list the names empty but not with a value', () => {
    expect(checkNoAttackMode(tmp({ '.env.example': 'ATTACK_MODE=\nCONTENTOOLS_JWT_CANARY=\n' }), {})).toEqual([]);
    expect(checkNoAttackMode(tmp({ '.env.example': 'ATTACK_MODE=1\n' }), {}).join('\n')).toMatch(/\.env\.example gives ATTACK_MODE a value/);
  });
  it('a truthy switch in a production environment fails, a development one passes', () => {
    expect(checkNoAttackMode(tmp({}), { NODE_ENV: 'production', ATTACK_MODE: '1' }).join('\n')).toMatch(/ATTACK_MODE is set in a production environment/);
    expect(checkNoAttackMode(tmp({}), { NODE_ENV: 'production', ATTACK_MODE: '0' })).toEqual([]);
    expect(checkNoAttackMode(tmp({}), { NODE_ENV: 'development', ATTACK_MODE: '1' })).toEqual([]);
  });
  it('the real app passes', () => {
    expect(checkNoAttackMode(appRoot, {})).toEqual([]);
  });
});
