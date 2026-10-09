import { ApiError, handle, requireCustomer } from '@/lib/api';
import { FIELDS_INVALID, readJsonObject } from '@/lib/auth-route';
import { checkName } from '@/lib/auth-validation';
import { CustomerNotFoundError } from '@/lib/ct/customer-update';
import { updateName } from '@/lib/ct/profile';

/** PATCH /api/account/profile { firstName, lastName }: the signed-in patient changes their own name. Answers the new user. */
export async function PATCH(request: Request): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    const body = await readJsonObject(request);
    const problems: Record<string, string> = {};
    const firstProblem = checkName(body.firstName);
    const lastProblem = checkName(body.lastName);
    if (firstProblem) problems.firstName = firstProblem;
    if (lastProblem) problems.lastName = lastProblem;
    if (Object.keys(problems).length > 0) return Response.json({ error: FIELDS_INVALID, fields: problems }, { status: 400 });
    try {
      return await updateName(customerId, { firstName: String(body.firstName).trim(), lastName: String(body.lastName).trim() });
    } catch (error) {
      if (error instanceof CustomerNotFoundError) throw new ApiError(401, 'Please sign in to continue.');
      throw error;
    }
  });
}
