import { handle, requireBusinessUnit } from '@/lib/api';
import { notFoundError } from '@/lib/ct/ownership';
import { getPortalData } from '@/lib/portal/data-source';
import { DOC_TYPE, DOC_TYPES, fileName, wasteDocPdf } from '@/lib/portal/documents';
import { ownedRecordId, pdfResponse } from '@/lib/portal/download';

/** GET /api/portal/documents/[type]/[id]: a waste document as PDF, only for the owning company; otherwise 404. */
export const GET = handle(async (_request: Request, { params }: { params: Promise<{ type: string; id: string }> }) => {
  const { type, id } = await params;
  const session = await requireBusinessUnit();
  const recordId = ownedRecordId(session, id);
  if (!DOC_TYPES.includes(type)) throw notFoundError();
  const doc = (await getPortalData().wasteDocs(session.businessUnitKey)).find((d) => d.id === recordId && DOC_TYPE[d.kind] === type);
  if (!doc) throw notFoundError();
  return pdfResponse(fileName(type, doc.number, doc.date), wasteDocPdf(doc));
});
