// Demo customers (only with --with-demo). Password = env SEED_DEMO_PASSWORD (never committed); emails use example.com / example.de.
// Every record carries demoMarker 'malva-demo' (set by the reconciler). isEmailVerified is true (D-031).
import type { DemoCustomerDraft } from '../../types';

export const demoCustomers: DemoCustomerDraft[] = [
  {
    key: 'malva-demo-alex-rivera',
    email: 'alex.rivera@example.com',
    firstName: 'Alex',
    lastName: 'Rivera',
    customerGroup: 'existing-customer',
    address: { streetNumber: '245', streetName: 'Peachtree St NE', postalCode: '30309', city: 'Atlanta', state: 'GA', country: 'US' },
    accountNumber: 'MV-48210-7',
    creditApproved: true,
  },
  {
    key: 'malva-demo-jo-kim',
    email: 'jo.kim@example.com',
    firstName: 'Jo',
    lastName: 'Kim',
    customerGroup: 'existing-customer',
    address: { streetNumber: '1', streetName: 'Market St', postalCode: '94105', city: 'San Francisco', state: 'CA', country: 'US' },
    accountNumber: 'MV-51002-3',
    creditApproved: true,
  },
  {
    key: 'malva-demo-sam-carter',
    email: 'sam.carter@example.com',
    firstName: 'Sam',
    lastName: 'Carter',
    customerGroup: 'small-business',
    address: { streetNumber: '600', streetName: 'Congress Ave', postalCode: '78701', city: 'Austin', state: 'TX', country: 'US' },
    accountNumber: 'MV-53117-1',
    // exercises the stub credit decline
    creditApproved: false,
  },
  {
    key: 'malva-demo-pat-lee',
    email: 'pat.lee@example.com',
    firstName: 'Pat',
    lastName: 'Lee',
    customerGroup: 'employee',
    address: { streetNumber: '350', streetName: 'Fifth Ave', postalCode: '10118', city: 'New York', state: 'NY', country: 'US' },
    accountNumber: 'MV-54420-9',
    creditApproved: true,
  },
  {
    key: 'malva-demo-lena-weber',
    email: 'lena.weber@example.de',
    firstName: 'Lena',
    lastName: 'Weber',
    customerGroup: 'consumer',
    address: { streetNumber: '10', streetName: 'Unter den Linden', postalCode: '10115', city: 'Berlin', country: 'DE' },
    accountNumber: 'MV-55001-4',
    creditApproved: true,
  },
];
