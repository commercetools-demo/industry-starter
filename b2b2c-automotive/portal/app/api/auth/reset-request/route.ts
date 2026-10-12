// POST /api/auth/reset-request: on-screen password reset (R-08, owner Q-P01: no email is ever sent).
// DEMO ONLY: anyone who knows an email can reset that account, so the whole flow is gated by DEMO_ONSCREEN_RESET=on
// (404 otherwise). Known gap, cited by workstream X and recorded in Z: "on-screen password reset: anyone who knows an
// email can reset that account; demo only". The response never reveals whether the email exists: same status, same body
// shape, same length (a decoy token for unknown emails) and the same total response time.
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { isOnscreenResetEnabled } from '@/lib/portal/flags';
import { localeOf } from '@/lib/portal/auth-session';
import { ApiError, handle, json, parseJson } from '@/lib/portal/route-kit';
import { getPorts } from '@/lib/portal/seam';

const MESSAGE = 'If that account exists, continue below to choose a new password.';
const TOKEN_LENGTH = 32;
const MIN_MS = 400;
const JITTER_MS = 100;

const body = z.object({ email: z.string().trim().pipe(z.email('Enter a valid email address.')) });

const decoyToken = () => randomBytes(TOKEN_LENGTH).toString('base64url').slice(0, TOKEN_LENGTH);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const POST = handle(async (request: Request) => {
  if (!isOnscreenResetEnabled()) throw new ApiError(404, 'Not found');
  const { email } = await parseJson(request, body);
  const started = Date.now();
  const token = await getPorts().createPasswordToken(email.toLowerCase());
  const wait = MIN_MS + Math.floor(Math.random() * JITTER_MS) - (Date.now() - started);
  if (wait > 0) await sleep(wait);
  return json({ message: MESSAGE, resetPath: `/${localeOf(request)}/reset/${token ?? decoyToken()}` });
});
