import { SUPPORT_EMAIL, supportMailto } from './contact';

describe('supportMailto', () => {
  it('Replacement behaviour: supportMailto has only a subject parameter', () => {
    for (const [locale, subject] of [
      ['en-US', 'Malva%20Telecom%20support%20request'],
      ['de-DE', 'Anfrage%20an%20den%20Malva-Telecom-Support'],
    ] as const) {
      const href = supportMailto(locale);
      expect(href).toBe(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
      const params = new URL(href).searchParams;
      expect([...params.keys()]).toEqual(['subject']);
      expect(href).not.toMatch(/body=|cc=|bcc=/);
    }
  });
});
