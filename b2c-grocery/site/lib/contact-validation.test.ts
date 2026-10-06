import { MESSAGE_MAX, validateContact } from './contact-validation';

const valid = { name: 'Ada', email: 'ada@example.com', topic: 'order', message: 'Where is my order?' };

describe('validateContact', () => {
  it('valid input: trimmed value', () => {
    expect(validateContact({ ...valid, name: '  Ada  ' })).toEqual({ ok: true, value: { ...valid } });
  });

  it('Invalid email', () => {
    for (const email of ['nope', 'a@b', 'a b@c.de', '']) {
      const r = validateContact({ ...valid, email });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.email).toBe(email ? 'invalidEmail' : 'required');
    }
  });

  it('message too short and too long', () => {
    const short = validateContact({ ...valid, message: 'too short' });
    const long = validateContact({ ...valid, message: 'x'.repeat(MESSAGE_MAX + 1) });
    expect(short.ok === false && short.errors.message).toBe('tooShort');
    expect(long.ok === false && long.errors.message).toBe('tooLong');
  });

  it('unknown topic and non-object input', () => {
    const r = validateContact({ ...valid, topic: 'refund' });
    expect(r.ok === false && r.errors.topic).toBe('required');
    expect(validateContact(null).ok).toBe(false);
  });
});
