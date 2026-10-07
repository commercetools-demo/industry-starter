// Seeded postal table of the deterministic address resolver (T, same style as D-020's serviceability stub).

export interface ZipRow {
  city: string;
  state?: string;
  country: 'US' | 'DE';
}

/** Key = the first five characters of the postal code. */
export const ZIP_TABLE: Record<'US' | 'DE', Record<string, ZipRow>> = {
  US: {
    '10001': { city: 'New York', state: 'NY', country: 'US' },
    '94105': { city: 'San Francisco', state: 'CA', country: 'US' },
    '60601': { city: 'Chicago', state: 'IL', country: 'US' },
    '73301': { city: 'Austin', state: 'TX', country: 'US' },
    '98101': { city: 'Seattle', state: 'WA', country: 'US' },
    '02108': { city: 'Boston', state: 'MA', country: 'US' },
    '33101': { city: 'Miami', state: 'FL', country: 'US' },
    '80202': { city: 'Denver', state: 'CO', country: 'US' },
    '30301': { city: 'Atlanta', state: 'GA', country: 'US' },
    '90001': { city: 'Los Angeles', state: 'CA', country: 'US' },
  },
  DE: {
    '10115': { city: 'Berlin', country: 'DE' },
    '80331': { city: 'München', country: 'DE' },
    '20095': { city: 'Hamburg', country: 'DE' },
    '50667': { city: 'Köln', country: 'DE' },
  },
};

/** The 50 states and the District of Columbia (two-letter codes). */
export const US_STATES: readonly string[] = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];
