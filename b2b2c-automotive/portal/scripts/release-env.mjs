/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/** A release build: RELEASE=1, or a production Netlify context. */
export const isRelease = (env) => env.RELEASE === '1' || (env.NODE_ENV === 'production' && env.CONTEXT === 'production');
