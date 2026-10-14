// POST /api/auth/reset: sets a new password from an on-screen reset token (R-08). Demo only, see reset-request/route.ts.
import { z } from 'zod';
import { isOnscreenResetEnabled } from '@/lib/portal/flags';
import { ApiError, handle, json, parseJson } from '@/lib/portal/route-kit';
import { getPorts } from '@/lib/portal/seam';

const body = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(12, 'The password must have at least 12 characters.'),
});

export const POST = handle(async (request: Request) => {
  if (!isOnscreenResetEnabled()) throw new ApiError(404, 'Not found');
  const { token, password } = await parseJson(request, body);
  const ok = await getPorts().resetPassword(token, password);
  if (!ok) throw new ApiError(400, 'This reset link is invalid or has expired.', 'INVALID_TOKEN');
  return json({ status: 'reset' });
});
