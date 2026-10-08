import { ApiError, handle, requireCustomer } from '@/lib/api';
import { getBookingPatient } from '@/lib/ct/booking-patient';
import { BookingNotCancellableError, BookingNotFoundError, CancelTooLateError, cancelBooking } from '@/lib/ct/bookings';

/**
 * POST /api/bookings/:ref/cancel: the signed-in patient cancels their own upcoming booking, at least 2 h before the
 * start (Q-027); the slot is released. An unknown reference and someone else's booking answer the same 404. Too late
 * answers 409 with `code: 'too-late'`. No reschedule in v1. Nothing about the booking is logged.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ ref: string }> }): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    const { ref } = await ctx.params;
    const patient = await getBookingPatient(customerId);
    if (!patient?.patientRef) throw new ApiError(404, 'Not found.');
    try {
      const booking = await cancelBooking(ref, { patientRef: patient.patientRef });
      return { status: 'cancelled', reference: booking.reference };
    } catch (error) {
      if (error instanceof BookingNotFoundError) throw new ApiError(404, 'Not found.');
      if (error instanceof CancelTooLateError) {
        return Response.json({ error: 'This appointment can no longer be cancelled.', code: 'too-late' }, { status: 409 });
      }
      if (error instanceof BookingNotCancellableError) throw new ApiError(409, 'This appointment can no longer be cancelled.');
      throw error;
    }
  });
}
