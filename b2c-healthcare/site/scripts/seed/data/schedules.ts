import type { Schedule, Weekday } from '../../../lib/clinical/slots';
import { DOCTORS, doctorKey } from './doctors';

/** The prototype's ten base times (`app-core.jsx`), thinned per doctor and weekday so the doctors do not all look alike. Times are in the doctor's own zone. */
export const BASE_TIMES = ['09:00', '09:30', '10:00', '10:30', '11:30', '13:00', '14:30', '15:00', '16:00', '17:30'];

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export interface ScheduleSeed { doctorKey: string; schedule: Schedule }

export const SCHEDULES: ScheduleSeed[] = DOCTORS.map((d, n) => {
  const weekly: Schedule['weekly'] = {};
  WEEKDAYS.forEach((day, di) => {
    weekly[day] = BASE_TIMES.filter((_, k) => (n * 7 + di * 3 + k * 2) % 3 !== 0);
  });
  if (n % 2 === 0) weekly.sat = ['09:00', '10:30'];
  return { doctorKey: doctorKey(d), schedule: { timezone: d.timezone, weekly, slotMinutes: 30 } };
});
