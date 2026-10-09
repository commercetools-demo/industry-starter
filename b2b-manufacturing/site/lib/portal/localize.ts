import 'server-only';
import { getAllServices } from '@/lib/ct/services';
import type { Visit } from './data-source';

/** Swaps the English fallback service name for the localized service name; any lookup failure keeps the fallback. */
export async function localizeVisits(visits: Visit[], locale: string): Promise<Visit[]> {
  if (!visits.some((v) => v.serviceSlug)) return visits;
  try {
    const names = new Map((await getAllServices(locale)).map((s) => [s.key, s.name]));
    return visits.map((v) => ({ ...v, service: (v.serviceSlug && names.get(`mpw-svc-${v.serviceSlug}`)) || v.service }));
  } catch {
    return visits;
  }
}
