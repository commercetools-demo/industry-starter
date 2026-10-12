// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Greeting by the hour in Europe/Berlin (decision 8), so the server render and the browser agree. Pure and client safe.
export type GreetingKey = 'morning' | 'afternoon' | 'evening';

export function berlinHour(now: Date): number {
  const hour = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Berlin' }).format(now);
  return Number.parseInt(hour, 10);
}

/** 05:00 to 11:59 morning, 12:00 to 17:59 afternoon, otherwise evening. */
export function greetingKey(now: Date): GreetingKey {
  const hour = berlinHour(now);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}
