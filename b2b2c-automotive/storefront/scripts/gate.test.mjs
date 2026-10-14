// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkMessages } from './check-messages.mjs';
import { checkNoDevPages } from './check-no-dev-pages.mjs';
import { checkNoHealthInRelease } from './check-no-health-in-release.mjs';
import { checkSecrets } from './check-secrets.mjs';
import { checkServerOnly } from './check-server-only.mjs';
import { checkTailwind } from './check-tailwind.mjs';
import { checkTokens } from './check-tokens.mjs';
import { checkVersions } from './check-versions.mjs';

const root = process.cwd();

describe('Gates and tests: clean scaffold', () => {
  it('Gate on a clean scaffold', () => {
    expect(checkVersions(root)).toEqual([]);
    expect(checkTailwind(root)).toEqual([]);
    expect(checkSecrets(root, [])).toEqual([]);
    expect(checkServerOnly(root)).toEqual([]);
    expect(checkTokens(root)).toEqual([]);
    expect(checkMessages(root)).toEqual([]);
    expect(checkNoDevPages(root, {})).toEqual([]);
    // Workstream G ships the dev-only health route, so a development check passes and a release check names it.
    expect(checkNoHealthInRelease(root, {})).toEqual([]);
  });
  it('a release build has no health route: the real route is the only one and the release gate names it', () => {
    expect(checkNoHealthInRelease(root, { RELEASE: '1' }).join('\n')).toMatch(/app\/api\/health\/route\.ts/);
  });
  it('a release build has no dev pages: the specimen is the only dev page and the release gate names it', () => {
    expect(checkNoDevPages(root, { RELEASE: '1' }).join('\n')).toMatch(/app\/dev\/tokens\/page\.tsx/);
  });
});
