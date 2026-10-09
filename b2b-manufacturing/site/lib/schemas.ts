import { z } from 'zod';
import { isDisposableEmail, isEmail, SECTORS } from './validation';

/** Request-body schemas for the Route Handlers (U-05): every handler that reads a body validates it with one of these. Messages are shown to visitors. */
const text = (max: number) => z.string().trim().max(max);
const required = (message: string, max = 200) => text(max).min(1, message);
const email = z.string().trim().toLowerCase().max(254).refine(isEmail, 'Enter a valid work email.');

/** Demo sign-in sends only the email; whether it is a sample customer is checked on the server. */
export const demoLoginSchema = z.object({ email: z.string().trim().toLowerCase().max(254) });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).refine(isEmail, 'Enter your email and password.'),
  password: z.string().min(1, 'Enter your email and password.').max(200),
});

export const registerSchema = z.object({
  companyName: required('Enter your company name.'),
  sector: z.enum(SECTORS, { error: 'Choose a sector.' }),
  firstName: required('Enter your first name.', 100),
  lastName: required('Enter your last name.', 100),
  jobTitle: text(100).default(''),
  email: email.refine((v) => !isDisposableEmail(v), 'Use your work email address.'),
  phone: text(40).default(''),
  password: z.string().min(1, 'Enter a password.').max(200),
  // Bot signals (U-03): `website` is a hidden honeypot, `startedAt` the time the form was shown.
  website: z.string().max(200).default(''),
  startedAt: z.number().default(0),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const profileSchema = z.object({
  firstName: required('Enter your first and last name.', 100),
  lastName: required('Enter your first and last name.', 100),
  jobTitle: text(100).default(''),
  phone: text(40).default(''),
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current and new password.').max(200),
  newPassword: z.string().min(1, 'Enter your current and new password.').max(200),
});

export const selectBusinessUnitSchema = z.object({ businessUnitKey: z.string().min(1, 'businessUnitKey is required').max(100) });

export const localeSchema = z.object({ locale: z.enum(['en-US', 'de-DE'], { error: 'Unsupported locale.' }) });
