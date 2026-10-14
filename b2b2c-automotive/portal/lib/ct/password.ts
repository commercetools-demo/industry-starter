/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { apiRoot } from '@/lib/ct/client';

const TTL_MINUTES = 15;

/** Password token for a known email (valid 15 minutes); `null` when no customer has that email. Demo only (R-08). */
export async function createPasswordToken(email: string): Promise<string | null> {
  try {
    const { body } = await apiRoot.customers().passwordToken().post({ body: { email, ttlMinutes: TTL_MINUTES } }).execute();
    return body.value;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return null;
    throw error;
  }
}

/** Sets the new password; `false` for an invalid or expired token. */
export async function resetPasswordWithToken(tokenValue: string, newPassword: string): Promise<boolean> {
  try {
    await apiRoot.customers().passwordReset().post({ body: { tokenValue, newPassword } }).execute();
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 400 || status === 404) return false;
    throw error;
  }
}
