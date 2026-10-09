import { handle, requireBusinessUnit } from '@/lib/api';
import { notFoundError } from '@/lib/ct/ownership';
import { getPortalData } from '@/lib/portal/data-source';
import { fileName, visitPdf } from '@/lib/portal/documents';
import { ownedRecordId, pdfResponse } from '@/lib/portal/download';

/** GET /api/portal/visits/[id]: the visit report as PDF, only for the owning company; otherwise 404. */
export const GET = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const session = await requireBusinessUnit();
  const recordId = ownedRecordId(session, id);
  const visit = (await getPortalData().visits(session.businessUnitKey)).find((v) => v.id === recordId);
  if (!visit) throw notFoundError();
  return pdfResponse(fileName('visit-report', visit.reportNumber ?? visit.id, visit.date), visitPdf(visit));
});
