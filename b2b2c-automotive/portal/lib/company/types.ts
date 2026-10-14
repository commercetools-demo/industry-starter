// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// App types of Company & team and Account settings (workstream U-09, U-10). Components import these, never lib/ct or the SDK.

export type UserStatus = 'Active' | 'Invited';

export interface UserRow {
  customerId: string;
  name: string;
  email: string;
  /** Associate role name ("Admin", "Buyer"), from the role key. */
  role: string;
  roleKey: string;
  status: UserStatus;
  /** ISO date time of `malva-customer.lastActiveAt`, or null (shown as a dash). */
  lastActive: string | null;
}

export interface RoleOption {
  key: string;
  name: string;
}

export type AddressType = 'Delivery' | 'Delivery & billing' | 'Billing';

export interface AddressRow {
  id: string;
  label: string;
  streetName: string;
  streetNumber?: string;
  postalCode: string;
  city: string;
  country: string;
  type: AddressType;
  isDefault: boolean;
}

export interface ProfileView {
  name: string;
  contactEmail: string;
  /** `mau-business-unit-fields.kind`, for example `reseller`. */
  kind: string;
  storeKey: string;
  storeName: string;
  /** Region and currency come from the store's `store-settings` ("Managed by Malva"). */
  region: string;
  currency: string;
}

export interface InviteResult {
  /** One-time accept-invite path; shown to the Admin once, never stored or logged. */
  invitePath: string;
  user: UserRow;
}

// ---- account settings ----

export interface AccountProfile {
  firstName: string;
  lastName: string;
  email: string;
}

export interface AccountAddress {
  id: string;
  streetName: string;
  streetNumber?: string;
  postalCode: string;
  city: string;
  country: string;
  isDefault: boolean;
}

export interface AccountUnitRow {
  key: string;
  name: string;
  /** "Company" or "Division". */
  type: string;
  roles: string[];
  storeName: string;
  /** "Explicit" for a store set on the unit, "FromParent" when inherited. */
  storeMode: 'Explicit' | 'FromParent';
}
