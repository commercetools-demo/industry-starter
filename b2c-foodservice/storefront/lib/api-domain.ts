import 'server-only';

/** Domain codes of the auth workstream (Q-J-13). D's `ErrorCode` stays closed; these never carry commercetools text. */
export type DomainErrorCode =
  | 'invalid_credentials'
  | 'too_many_attempts'
  | 'password_policy'
  | 'registration_failed'
  | 'invalid_request'
  | 'not_found'
  | 'token_invalid';

const DOMAIN_MESSAGES: Record<DomainErrorCode, string> = {
  invalid_credentials: 'Email or password is incorrect',
  too_many_attempts: 'Too many attempts. Please try again later',
  password_policy: 'The password does not meet the requirements',
  registration_failed: 'We could not create the account with these details',
  invalid_request: 'The request could not be understood',
  not_found: 'Not found',
  token_invalid: 'This link is no longer valid',
};

/** Same envelope as D: `{ error: { code, message, ...extra } }`. Extras are plain data (rule ids, retryAfterSeconds). */
export function domainError(
  code: DomainErrorCode,
  status: number,
  extra: Record<string, string | number | string[]> = {},
): Response {
  return Response.json({ error: { code, message: DOMAIN_MESSAGES[code], ...extra } }, { status });
}
