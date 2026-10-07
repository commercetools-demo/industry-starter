const execute = vi.fn();
const withId = vi.fn(() => ({ get: () => ({ execute }) }));

vi.mock('./client', () => ({ getApiRoot: () => ({ customers: () => ({ withId }) }) }));
vi.mock('./timeout', () => ({ withTimeout: (promise: Promise<unknown>) => promise }));

import { getAccountFirstName } from './account-name';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAccountFirstName', () => {
  it('reads the customer of the session id and returns the trimmed first name', async () => {
    execute.mockResolvedValue({ body: { firstName: ' Alex ' } });
    await expect(getAccountFirstName('cust-1')).resolves.toBe('Alex');
    expect(withId).toHaveBeenCalledWith({ ID: 'cust-1' });
  });

  it('a customer without a first name gives an empty string', async () => {
    execute.mockResolvedValue({ body: {} });
    await expect(getAccountFirstName('cust-1')).resolves.toBe('');
  });

  it('a failed read gives an empty string and logs without the error message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    execute.mockRejectedValue(new Error('secret detail'));
    await expect(getAccountFirstName('cust-1')).resolves.toBe('');
    expect(spy).toHaveBeenCalledWith('[shell] customer name unavailable', 'Error');
    spy.mockRestore();
  });
});
