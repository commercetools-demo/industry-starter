import { ROLE_KEYS } from './roles';

/**
 * Synthetic demo companies. All addresses are `@example.com`; the password for every demo user is SEED_DEMO_PASSWORD.
 * `mpw-demo-co` is the main demo company; `mpw-other-co` exists to prove that one company never sees another's data.
 */
export interface DemoUser {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  phone: string;
  role: (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];
}

export interface DemoSite {
  key: string;
  name: string;
  streetName: string;
  city: string;
  postalCode: string;
}

export interface DemoCompany {
  key: string;
  name: string;
  sector: 'facilities' | 'manufacturing' | 'property' | 'healthcare' | 'other';
  users: DemoUser[];
  sites: DemoSite[];
}

export const DEMO_COMPANIES: DemoCompany[] = [
  {
    key: 'mpw-demo-co',
    name: 'Northfield Foods (demo)',
    sector: 'manufacturing',
    users: [
      { key: 'mpw-demo-admin', email: 'demo.admin@example.com', firstName: 'Dana', lastName: 'Admin', jobTitle: 'Head of Facilities', phone: '(216) 555-0101', role: ROLE_KEYS.admin },
      { key: 'mpw-demo-site', email: 'demo.site@example.com', firstName: 'Sam', lastName: 'Site', jobTitle: 'Site manager', phone: '(216) 555-0102', role: ROLE_KEYS.siteContact },
      { key: 'mpw-demo-finance', email: 'demo.finance@example.com', firstName: 'Fran', lastName: 'Finance', jobTitle: 'Finance controller', phone: '(216) 555-0103', role: ROLE_KEYS.finance },
    ],
    sites: [
      { key: 'mpw-demo-site-1', name: 'Northfield main plant', streetName: '1 Mill Lane', city: 'Cleveland', postalCode: '44114' },
      { key: 'mpw-demo-site-2', name: 'Northfield distribution centre', streetName: '22 Depot Road', city: 'Columbus', postalCode: '43215' },
    ],
  },
  {
    key: 'mpw-other-co',
    name: 'Riverside Care Group (demo)',
    sector: 'healthcare',
    users: [{ key: 'mpw-other-admin', email: 'other.admin@example.com', firstName: 'Olu', lastName: 'Other', jobTitle: 'Estates manager', phone: '(312) 555-0110', role: ROLE_KEYS.admin }],
    sites: [{ key: 'mpw-other-site-1', name: 'Riverside clinic', streetName: '5 Quay Street', city: 'Chicago', postalCode: '60601' }],
  },
];
