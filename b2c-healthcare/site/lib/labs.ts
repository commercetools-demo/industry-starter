// Lab result maths (design-account-area: Result table). Pure: no server imports, so components and tests share it.
// Reference ranges are fixed per test (Q-046): they come with each result, not from the patient's age or sex.

export type LabFlag = 'normal' | 'high' | 'low';

/** The marker never touches the ends of the track (design: clamped to 4-96 %). */
export const MARKER_MIN = 4;
export const MARKER_MAX = 96;

export function flagFor(value: number, low: number, high: number): LabFlag {
  if (value < low) return 'low';
  if (value > high) return 'high';
  return 'normal';
}

/** Position of the marker on the range bar, in percent of the track. A zero-width range counts as width 1. */
export function markerPosition(value: number, low: number, high: number): number {
  const span = high - low || 1;
  return Math.max(MARKER_MIN, Math.min(MARKER_MAX, ((value - low) / span) * 100));
}

/** `< 200 mg/dL` when the lower bound is 0, otherwise `12 – 17.5 g/dL`. */
export function rangeLabel(low: number, high: number, unit: string): string {
  const range = low === 0 ? `< ${high}` : `${low} – ${high}`;
  return unit ? `${range} ${unit}` : range;
}
