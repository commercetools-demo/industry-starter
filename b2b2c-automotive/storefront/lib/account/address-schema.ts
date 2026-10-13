// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { z } from 'zod';

/** The address form body shared by the add and change routes. Country and postal code are checked again against the store in `lib/ct/account-addresses.ts`. */
export const addressBody = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  streetName: z.string().trim().min(1).max(200),
  streetNumber: z.string().trim().max(20).optional(),
  postalCode: z.string().trim().min(2).max(12),
  city: z.string().trim().min(1).max(100),
  country: z.string().trim().length(2),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[0-9 +()./-]*$/, 'Invalid phone number')
    .optional(),
  makeDefault: z.boolean().optional(),
});
