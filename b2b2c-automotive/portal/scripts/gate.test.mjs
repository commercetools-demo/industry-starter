/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { checkBundleSecretsDir } from './gate-helpers.mjs';
import { checkMessages } from './check-messages.mjs';
import { checkNoDevPages } from './check-no-dev-pages.mjs';
import { checkNoHealthInRelease } from './check-no-health-in-release.mjs';
import { checkSecrets } from './check-secrets.mjs';
import { checkServerOnly } from './check-server-only.mjs';
import { checkTailwind } from './check-tailwind.mjs';
import { checkTokens } from './check-tokens.mjs';
import { checkVersions } from './check-versions.mjs';
import { appRoot } from './test-utils.mjs';

describe('Gates and tests', () => {
  it('Gate on a clean scaffold', () => {
    expect(checkVersions(appRoot)).toEqual([]);
    expect(checkTailwind(appRoot)).toEqual([]);
    expect(checkSecrets(appRoot, [])).toEqual([]);
    expect(checkServerOnly(appRoot)).toEqual([]);
    expect(checkTokens(appRoot)).toEqual([]);
    expect(checkMessages(appRoot)).toEqual([]);
    expect(checkNoDevPages(appRoot)).toEqual([]);
    // Workstream G ships the dev-only health route, so a development check passes and a release check names it.
    expect(checkNoHealthInRelease(appRoot, {})).toEqual([]);
    expect(checkBundleSecretsDir(appRoot)).toEqual([]);
  });

  it('a release build names the dev-only health route', () => {
    expect(checkNoHealthInRelease(appRoot, { RELEASE: '1' }).join('\n')).toMatch(/app\/api\/health\/route\.ts/);
  });
});
