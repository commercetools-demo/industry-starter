/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Small helper of W's seller routes: a dynamic path segment is checked before it is used (404 for anything unusual).
import 'server-only';
import { ApiError } from './route-kit';

export type Params<K extends string> = { params: Promise<Record<K, string>> };

export async function pathParam<K extends string>(context: Params<K>, name: K): Promise<string> {
  const value = (await context.params)[name];
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,200}$/.test(value)) throw new ApiError(404, 'Not found');
  return value;
}
