import { ApiError, handle, requireCustomer } from '@/lib/api';
import { FIELDS_INVALID, WRONG_CURRENT_PASSWORD, readJsonObject, tooManyAttempts } from '@/lib/auth-route';
import { TooManyAttemptsError, ValidationError, WrongCurrentPasswordError, changePassword } from '@/lib/ct/identity';

/** POST /api/account/password { currentPassword, newPassword }: a signed-in patient changes their password. */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    const body = await readJsonObject(request);
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    if (!current) return Response.json({ error: FIELDS_INVALID, fields: { currentPassword: 'required' } }, { status: 400 });
    try {
      await changePassword(customerId, current, typeof body.newPassword === 'string' ? body.newPassword : '');
      return { ok: true };
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json({ error: FIELDS_INVALID, fields: { newPassword: error.problems.password } }, { status: 400 });
      }
      if (error instanceof WrongCurrentPasswordError) throw new ApiError(400, WRONG_CURRENT_PASSWORD);
      if (error instanceof TooManyAttemptsError) return tooManyAttempts(error);
      throw error;
    }
  });
}
