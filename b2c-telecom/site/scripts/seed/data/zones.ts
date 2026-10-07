import type { ZoneCoverageDraft } from '../types';
import { MARKETS } from './market';

// Coverage, not ownership: the existing zones holding US and DE are adopted (a country belongs to one zone only).
export const zoneCoverage: ZoneCoverageDraft[] = MARKETS.map((m) => ({ key: m.country, country: m.country }));
