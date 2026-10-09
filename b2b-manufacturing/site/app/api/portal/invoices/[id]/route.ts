import { handle, requireBusinessUnit } from '@/lib/api';
import { notFoundError } from '@/lib/ct/ownership';
import { getPortalData } from '@/lib/portal/data-source';
import { fileName, invoicePdf } from '@/lib/portal/documents';
import { ownedRecordId, pdfResponse } from '@/lib/portal/download';

/** GET /api/portal/invoices/[id]: the invoice as PDF, only for the owning company; otherwise 404. */
export const GET = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const session = await requireBusinessUnit();
  const recordId = ownedRecordId(session, id);
  const invoice = (await getPortalData().invoices(session.businessUnitKey)).find((i) => i.id === recordId);
  if (!invoice) throw notFoundError();
  return pdfResponse(fileName('invoice', invoice.number, invoice.date), invoicePdf(invoice));
});
