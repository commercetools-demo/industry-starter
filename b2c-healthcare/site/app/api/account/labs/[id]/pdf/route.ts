import { ApiError, handle, requireCustomer } from '@/lib/api';
import { getLabDetail } from '@/lib/ct/account-labs';
import { formatIsoDate } from '@/lib/format-date';
import { buildLabPdf, type LabPdfLabels } from '@/lib/lab-pdf';
import messages from '@/messages/en-US.json';

const LABELS = messages.account.labs;
const PDF_LABELS: LabPdfLabels = {
  ...LABELS.pdf,
  flags: { normal: LABELS.flagNormal, high: LABELS.flagHigh, low: LABELS.flagLow },
};

/**
 * GET /api/account/labs/:id/pdf: the results of one of the signed-in patient's tests as a PDF (Q-045). An
 * authenticated GET, so no value is ever in the URL; the answer is `no-store` and nothing is logged. An unknown, a
 * foreign and a still-processing test all answer the same 404.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    const { id } = await ctx.params;
    const lab = await getLabDetail(customerId, id);
    if (!lab || lab.status !== 'ready' || lab.results.length === 0) throw new ApiError(404, 'Not found.');
    const bytes = await buildLabPdf(lab, PDF_LABELS, formatIsoDate(lab.collectedAt, 'en-US'));
    return new Response(Buffer.from(bytes), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="lab-results-${lab.id.replace(/[^\w.-]/g, '')}.pdf"`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  });
}
