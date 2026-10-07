import { ApiError } from '@/lib/fetcher';

export const MIN_PASSWORD_LENGTH = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Keys of `auth.errors.*`. */
export type FieldError = 'required' | 'email' | 'passwordShort';

export const requiredError = (value: string): FieldError | null => (value.trim() ? null : 'required');
export const emailError = (value: string): FieldError | null => (!value.trim() ? 'required' : EMAIL.test(value.trim()) ? null : 'email');
export const newPasswordError = (value: string): FieldError | null => (!value ? 'required' : value.length < MIN_PASSWORD_LENGTH ? 'passwordShort' : null);

export const formValue = (data: FormData, name: string): string => {
  const v = data.get(name);
  return typeof v === 'string' ? v : '';
};

/** The API error code (`RATE_LIMITED`, `ACCOUNT_EXISTS`, ...) of a failed request, or `null`. */
export const apiErrorCode = (e: unknown): string | null => (e instanceof ApiError ? e.message : null);
