import request from 'supertest';
import { createApp } from '../src/app';
import { presentNotes, sortNotes } from '../src/notes';
import { CID, customer, FakeApi, OURS } from './fake-api';

const quiet = () => undefined;
const withNotes = (notes: string[], extra: Record<string, unknown> = {}) =>
  new FakeApi().add(customer(CID, { key: OURS, fields: { paymentAccountIds: ['pay-1'], notes, ...extra } }));
const appFor = (api: FakeApi) => createApp(api, { log: quiet });
const stored = (api: FakeApi) => (api.customers.get(CID)!.custom!.fields as Record<string, unknown>);

describe('notes read and sort', () => {
  it('same contents in any order give the same indexes', () => {
    expect(presentNotes(['zebra', 'alpha', 'Mango'])).toEqual(presentNotes(['Mango', 'zebra', 'alpha']));
    expect(sortNotes(['b', 'a', 'B'])).toEqual(sortNotes(['B', 'b', 'a']));
  });

  it('GET returns indexed, sorted notes', async () => {
    const res = await request(appFor(withNotes(['zebra', 'alpha']))).get(`/customers/${CID}/notes`);
    expect(res.body).toEqual({
      notes: [
        { index: 0, text: 'alpha' },
        { index: 1, text: 'zebra' },
      ],
    });
  });

  it('absent field, no custom type, or another custom type gives []', async () => {
    for (const c of [customer(CID), customer(CID, { key: OURS, fields: {} }), customer(CID, { key: 'other-type', fields: { notes: ['x'] } })]) {
      const res = await request(appFor(new FakeApi().add(c))).get(`/customers/${CID}/notes`);
      expect(res.body).toEqual({ notes: [] });
    }
  });

  it('index not a whole number answers 400, out of range answers 404', async () => {
    const app = appFor(withNotes(['a']));
    for (const bad of ['abc', '-1', '1.5']) {
      expect((await request(app).put(`/customers/${CID}/notes/${bad}`).send({ text: 'x' })).status).toBe(400);
    }
    expect((await request(app).put(`/customers/${CID}/notes/5`).send({ text: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/customers/${CID}/notes/5`)).status).toBe(404);
  });
});

describe('notes add (POST)', () => {
  it('customer with the type gets setCustomField only', async () => {
    const api = withNotes(['alpha']);
    const res = await request(appFor(api)).post(`/customers/${CID}/notes`).send({ text: '  beta  ' });
    expect(res.status).toBe(201);
    expect(res.body.notes.map((n: { text: string }) => n.text)).toEqual(['alpha', 'beta']);
    expect(api.updates).toHaveLength(1);
    expect(api.updates[0].actions).toEqual([{ action: 'setCustomField', name: 'notes', value: ['alpha', 'beta'] }]);
  });

  it('customer without a type gets setCustomType with notes', async () => {
    const api = new FakeApi().add(customer(CID));
    const res = await request(appFor(api)).post(`/customers/${CID}/notes`).send({ text: 'first' });
    expect(res.status).toBe(201);
    expect(api.updates[0].actions).toEqual([
      { action: 'setCustomType', type: { typeId: 'type', key: OURS }, fields: { notes: ['first'] } },
    ]);
  });

  it('customer with another type answers 409 and is not written', async () => {
    const api = new FakeApi().add(customer(CID, { key: 'other-type', fields: {} }));
    const res = await request(appFor(api)).post(`/customers/${CID}/notes`).send({ text: 'x' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('foreign_custom_type');
    expect(api.updates).toHaveLength(0);
  });

  it('paymentAccountIds is never in the actions and survives', async () => {
    const api = withNotes([]);
    await request(appFor(api)).post(`/customers/${CID}/notes`).send({ text: 'x' });
    expect(JSON.stringify(api.updates)).not.toContain('paymentAccountIds');
    expect(api.updates.every((u) => u.actions.every((a) => a.action !== 'setCustomType'))).toBe(true);
    expect(stored(api).paymentAccountIds).toEqual(['pay-1']);
  });

  it('duplicate text answers 409', async () => {
    const res = await request(appFor(withNotes(['alpha']))).post(`/customers/${CID}/notes`).send({ text: 'alpha' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('duplicate_note');
  });

  it.each([{ text: '' }, { text: '   ' }, { text: 'x'.repeat(1001) }, {}, { text: 5 }])('invalid text %j answers 400', async (body) => {
    const res = await request(appFor(withNotes([]))).post(`/customers/${CID}/notes`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_text');
  });

  it('the 101st note answers 409', async () => {
    const existing = Array.from({ length: 100 }, (_, i) => `note ${i}`);
    const res = await request(appFor(withNotes(existing))).post(`/customers/${CID}/notes`).send({ text: 'one more' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('too_many_notes');
  });
});

describe('notes edit and delete', () => {
  it('PUT edits the note at the sorted index', async () => {
    const api = withNotes(['zebra', 'alpha']);
    const res = await request(appFor(api)).put(`/customers/${CID}/notes/1`).send({ text: 'yak', expected: 'zebra' });
    expect(res.status).toBe(200);
    expect(res.body.notes.map((n: { text: string }) => n.text)).toEqual(['alpha', 'yak']);
  });

  it('expected mismatch answers 409 and writes nothing', async () => {
    const api = withNotes(['alpha', 'beta']);
    const put = await request(appFor(api)).put(`/customers/${CID}/notes/0`).send({ text: 'x', expected: 'beta' });
    const del = await request(appFor(api)).delete(`/customers/${CID}/notes/0`).send({ expected: 'beta' });
    expect([put.status, del.status]).toEqual([409, 409]);
    expect(put.body.error).toBe('note_changed');
    expect(api.updates).toHaveLength(0);
  });

  it('edit to an existing text answers 409', async () => {
    const res = await request(appFor(withNotes(['alpha', 'beta']))).put(`/customers/${CID}/notes/0`).send({ text: 'beta' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('duplicate_note');
  });

  it('DELETE removes the note; expected also works as a query parameter', async () => {
    const api = withNotes(['alpha', 'beta']);
    const res = await request(appFor(api)).delete(`/customers/${CID}/notes/1?expected=beta`);
    expect(res.status).toBe(200);
    expect(res.body.notes).toEqual([{ index: 0, text: 'alpha' }]);
  });

  it('deleting the last note removes the field', async () => {
    const api = withNotes(['only']);
    const res = await request(appFor(api)).delete(`/customers/${CID}/notes/0`);
    expect(res.body).toEqual({ notes: [] });
    expect(api.updates[0].actions).toEqual([{ action: 'setCustomField', name: 'notes', value: undefined }]);
    expect(stored(api).notes).toBeUndefined();
    expect(stored(api).paymentAccountIds).toEqual(['pay-1']);
  });

  it('ConcurrentModification is retried and then succeeds', async () => {
    const api = withNotes(['alpha']);
    api.conflicts = 1;
    const res = await request(appFor(api)).post(`/customers/${CID}/notes`).send({ text: 'beta' });
    expect(res.status).toBe(201);
    expect(api.updates).toHaveLength(2);
    expect(api.updates[1].version).toBe(api.updates[0].version + 1);
  });

  it('three conflicts answer 409 conflict', async () => {
    const api = withNotes(['alpha']);
    api.conflicts = 3;
    const res = await request(appFor(api)).post(`/customers/${CID}/notes`).send({ text: 'beta' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('conflict');
    expect(api.updates).toHaveLength(3);
  });

  it('other methods on the notes paths answer 405', async () => {
    const app = appFor(withNotes([]));
    expect((await request(app).put(`/customers/${CID}/notes`).send({})).headers.allow).toBe('GET, POST');
    expect((await request(app).post(`/customers/${CID}/notes/0`).send({})).headers.allow).toBe('PUT, DELETE');
  });
});

describe('loyalty points', () => {
  it('absent field answers 0', async () => {
    const res = await request(appFor(new FakeApi().add(customer(CID)))).get(`/customers/${CID}/loyaltyPoints`);
    expect(res.body).toEqual({ customerId: CID, loyaltyPoints: 0 });
  });

  it('value is returned as a number', async () => {
    const res = await request(appFor(withNotes([], { loyaltyPoints: 1250 }))).get(`/customers/${CID}/loyaltyPoints`);
    expect(res.body).toEqual({ customerId: CID, loyaltyPoints: 1250 });
  });

  it.each(['post', 'put', 'delete'] as const)('%s answers 405 and writes nothing', async (method) => {
    const api = withNotes([], { loyaltyPoints: 5 });
    const res = await request(appFor(api))[method](`/customers/${CID}/loyaltyPoints`).send({ loyaltyPoints: 999 });
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe('GET');
    expect(api.updates).toHaveLength(0);
  });
});
