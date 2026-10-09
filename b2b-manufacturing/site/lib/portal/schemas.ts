import { z } from 'zod';
import { isDisposableEmail, isEmail } from '../validation';
import { TEAM_ROLES } from './types';

/** Request-body schemas of the sites, team and quotes routes (workstreams R and S). Messages are shown to the user. */
const text = (max: number) => z.string().trim().max(max);
const required = (message: string, max: number) => text(max).min(1, message);

export const siteSchema = z.object({
  name: required('Enter a name for the site.', 100),
  streetName: required('Enter the street address.', 150),
  city: required('Enter the city.', 100),
  postalCode: required('Enter the postal code.', 20),
  country: z.string().trim().toUpperCase().pipe(z.enum(['US', 'DE'], { error: 'Choose a country.' })),
  contactName: text(100).default(''),
  phone: text(40).default(''),
});

export const teamInviteSchema = z.object({
  firstName: required('Enter their first name.', 100),
  lastName: required('Enter their last name.', 100),
  email: z.string().trim().toLowerCase().max(254)
    .refine(isEmail, 'Enter a valid work email.')
    .refine((v) => !isDisposableEmail(v), 'Use their work email address.'),
  roleKey: z.enum(TEAM_ROLES, { error: 'Choose a role.' }),
});

export const teamRoleSchema = z.object({ roleKey: z.enum(TEAM_ROLES, { error: 'Choose a role.' }) });

export const renegotiateSchema = z.object({ comment: z.string().trim().min(1, 'Write your question or the change you would like.').max(2000, 'Keep your message under 2000 characters.') });
