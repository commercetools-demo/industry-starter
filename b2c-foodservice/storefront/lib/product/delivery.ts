export interface DeliveryRule {
  /** Orders placed before this hour (0 to 23, market time zone) on a business day ship that day. */
  cutoffHour: number;
  timeZone: string;
  minDays: number;
  maxDays: number;
}

export interface DeliveryEstimate {
  /** The order still makes today's cut-off. */
  beforeCutoff: boolean;
  /** Whole hours (rounded up) until the cut-off; 0 when `beforeCutoff` is false. */
  hoursLeft: number;
  /** Calendar dates as UTC noon of the market-local date: format with `timeZone: 'UTC'`. */
  earliest: Date;
  latest: Date;
}

interface Local { y: number; m: number; d: number; hour: number; minute: number }

function localParts(now: Date, timeZone: string): Local {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(now);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: n('year'), m: n('month'), d: n('day'), hour: n('hour'), minute: n('minute') };
}

const isBusinessDay = (d: Date): boolean => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isBusinessDay(d)) left -= 1;
  }
  return d;
}

/**
 * Delivery estimate for the whole market (Q-H-02: commercetools has no per-address estimate before a cart exists).
 * Weekends are skipped. An order placed before the cut-off on a business day starts processing that day, any other
 * order starts on the next business day; delivery takes `minDays` to `maxDays` business days after that. Pure: `now` is
 * a parameter.
 */
export function deliveryEstimate(now: Date, rule: DeliveryRule): DeliveryEstimate {
  const local = localParts(now, rule.timeZone);
  const today = new Date(Date.UTC(local.y, local.m - 1, local.d, 12));
  const before = isBusinessDay(today) && local.hour < rule.cutoffHour;
  const start = before ? today : addBusinessDays(today, 1);
  const minutesLeft = (rule.cutoffHour - local.hour) * 60 - local.minute;
  return {
    beforeCutoff: before,
    hoursLeft: before ? Math.max(1, Math.ceil(minutesLeft / 60)) : 0,
    earliest: addBusinessDays(start, rule.minDays),
    latest: addBusinessDays(start, rule.maxDays),
  };
}
