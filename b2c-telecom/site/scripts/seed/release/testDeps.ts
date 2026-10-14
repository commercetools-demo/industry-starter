/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Test support: apply dependencies with a fixed clock, no disk and a collected log.
import type { CtApi } from '../lib';
import type { ApplyDeps } from './apply';
import { NOW } from './fixture';

/** Apply dependencies for tests: fixed clock, no disk, a log that is collected in `lines`. */
export function testDeps(api: CtApi, over: Partial<ApplyDeps> = {}): ApplyDeps & { lines: string[] } {
  const lines: string[] = [];
  return { api, log: (l) => void lines.push(l), operator: 'claude', ack: true, now: () => NOW, writeState: () => undefined, lines, ...over };
}
