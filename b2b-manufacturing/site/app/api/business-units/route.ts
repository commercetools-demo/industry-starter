import { handle, ok, requireCustomer } from '@/lib/api';
import { getBusinessUnitsForAssociate } from '@/lib/ct/business-units';

export const GET = handle(async () => {
  const session = await requireCustomer();
  return ok({ businessUnits: await getBusinessUnitsForAssociate(session.customerId), current: session.businessUnitKey ?? null });
});
