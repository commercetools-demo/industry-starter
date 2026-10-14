// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { adminRoot } from '@/lib/ct/admin-client';

/** Whether the seller-admin credentials work (reads one custom object, which `manage_key_value_documents` covers). No detail ever leaves. */
export async function probeAdmin(): Promise<boolean> {
  try {
    await adminRoot.customObjects().get({ queryArgs: { limit: 1 } }).execute();
    return true;
  } catch {
    return false;
  }
}
