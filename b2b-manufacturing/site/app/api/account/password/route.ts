import { ApiError, handle, ok, parseBody, requireCustomer } from '@/lib/api';
import { passwordSchema } from '@/lib/schemas';
import { changePassword } from '@/lib/ct/profile';
import { clearMustChangePassword } from '@/lib/ct/team-password';
import { checkPassword, PASSWORD_MESSAGES } from '@/lib/password';

export const POST = handle(async (request: Request) => {
  const session = await requireCustomer();
  const { currentPassword: current, newPassword: next } = await parseBody(request, passwordSchema);
  const rule = checkPassword(next);
  if (rule) throw new ApiError(400, PASSWORD_MESSAGES[rule]);
  if (!(await changePassword(session.customerId, current, next))) throw new ApiError(400, 'Your current password is incorrect.');
  await clearMustChangePassword(session.customerId);
  return ok({ ok: true });
});
