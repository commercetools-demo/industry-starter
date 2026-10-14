// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Input schemas of Company & team and Account settings (workstream U-09, U-10), shared by forms and Route Handlers. Pure.
// Strict objects: an id (customer, address, unit) is never taken from a body.
import { z } from 'zod';
import { ROLE } from '@/lib/roles';

/** The two roles a user can be invited as (D-028). Other roles of the project (for example `approver`) are never offered. */
export const INVITABLE_ROLE_KEYS = [ROLE.admin, ROLE.buyer] as const;

const name = (label: string) => z.string().trim().min(1, `Enter the ${label}`).max(80);
const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

export const inviteInput = z
  .object({
    email,
    firstName: name('first name'),
    lastName: name('last name'),
    roleKey: z.enum(INVITABLE_ROLE_KEYS, { message: 'Choose Admin or Buyer' }),
  })
  .strict();
export type InviteInput = z.infer<typeof inviteInput>;

export const ADDRESS_TYPES = ['Delivery', 'Delivery & billing', 'Billing'] as const;

export const addressInput = z
  .object({
    label: z.string().trim().min(1, 'Enter a label').max(60),
    streetName: z.string().trim().min(2, 'Enter the street').max(80),
    streetNumber: z.string().trim().max(10).optional(),
    postalCode: z.string().trim().min(2, 'Enter the postal code').max(12),
    city: z.string().trim().min(2, 'Enter the city').max(60),
    country: z.string().regex(/^[A-Z]{2}$/, 'Use a two-letter country code, for example DE'),
    type: z.enum(ADDRESS_TYPES),
    makeDefault: z.boolean().optional(),
  })
  .strict();
export type AddressInput = z.infer<typeof addressInput>;

export const defaultAddressInput = z.object({ addressId: z.string().min(1).max(100) }).strict();

export const profileInput = z
  .object({
    name: z.string().trim().min(2, 'Enter a company name of 2 to 120 characters').max(120, 'Enter a company name of 2 to 120 characters'),
    contactEmail: email,
  })
  .strict();
export type ProfileInput = z.infer<typeof profileInput>;

export const acceptInviteInput = z.object({ token: z.string().min(1).max(200), password: z.string().min(12, 'The password must have at least 12 characters.') }).strict();

// ---- account ----

export const accountProfileInput = z.object({ firstName: name('first name'), lastName: name('last name'), email }).strict();
export type AccountProfileInput = z.infer<typeof accountProfileInput>;

export const passwordInput = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(200),
    newPassword: z.string().min(12, 'The password must have at least 12 characters.').max(200),
  })
  .strict();

export const accountAddressInput = z
  .object({
    streetName: z.string().trim().min(2, 'Enter the street').max(80),
    streetNumber: z.string().trim().max(10).optional(),
    postalCode: z.string().trim().min(2, 'Enter the postal code').max(12),
    city: z.string().trim().min(2, 'Enter the city').max(60),
    country: z.string().regex(/^[A-Z]{2}$/, 'Use a two-letter country code, for example DE'),
    makeDefault: z.boolean().optional(),
  })
  .strict();
export type AccountAddressInput = z.infer<typeof accountAddressInput>;

export const removeAddressInput = z.object({ addressId: z.string().min(1).max(100) }).strict();
