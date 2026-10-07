// @vitest-environment node
import { makeContentRoot, removeContentRoots } from '@/test/content-fixtures';
import { getFaq } from './faq';
import { ContentError } from './types';

afterEach(removeContentRoots);

const EN = `---
title: FAQ
description: Questions
kicker: Help
---
## Billing {#billing}

### First? {#first}
First **answer** with [a link](/legal/terms).

### Second? {#second}
Second answer.

## Phones {#phones}

### Third? {#third}
Third answer.
`;

const DE_PARTIAL = `---
title: Häufige Fragen
description: Fragen
kicker: Hilfe
---
## Abrechnung {#billing}

### Erste? {#first}
Erste Antwort.

## Handys {#phones}

### Dritte? {#third}
Dritte Antwort.
`;

describe('getFaq', () => {
  it('Answer not translated: a missing German answer is served in English and flagged per question', () => {
    const root = makeContentRoot({ 'en-US/faq.md': EN, 'de-DE/faq.md': DE_PARTIAL });
    const faq = getFaq('de-DE', { root })!;
    expect(faq.page.fallback).toBe(false);
    expect(faq.page.title).toBe('Häufige Fragen');
    expect(faq.topics.map((t) => [t.id, t.title])).toEqual([
      ['billing', 'Abrechnung'],
      ['phones', 'Handys'],
    ]);
    const items = faq.topics.flatMap((t) => t.items);
    expect(items.map((i) => [i.id, i.question, i.fallback])).toEqual([
      ['first', 'Erste?', false],
      ['second', 'Second?', true],
      ['third', 'Dritte?', false],
    ]);
    expect(items[1].answerHtml).toContain('Second answer.');
  });

  it('serves the English order and ids for en-US with no fallback flags and plain-text answers', () => {
    const root = makeContentRoot({ 'en-US/faq.md': EN });
    const faq = getFaq('en-US', { root })!;
    const first = faq.topics[0].items[0];
    expect(first.fallback).toBe(false);
    expect(first.answerText).toBe('First answer with a link.');
    expect(first.answerHtml).toContain('href="/en-US/legal/terms"');
  });

  it('a German locale without any German file is wholly English and flagged', () => {
    const root = makeContentRoot({ 'en-US/faq.md': EN });
    const faq = getFaq('de-DE', { root })!;
    expect(faq.page.fallback).toBe(true);
    expect(faq.topics.flatMap((t) => t.items).every((i) => i.fallback)).toBe(true);
  });

  it('a heading without {#id} is a ContentError', () => {
    const root = makeContentRoot({ 'en-US/faq.md': EN.replace(' {#second}', '') });
    expect(() => getFaq('en-US', { root })).toThrow(ContentError);
  });

  it('duplicate ids and invalid ids are rejected', () => {
    expect(() => getFaq('en-US', { root: makeContentRoot({ 'en-US/faq.md': EN.replace('{#second}', '{#first}') }) })).toThrow('duplicate id');
    expect(() => getFaq('en-US', { root: makeContentRoot({ 'en-US/faq.md': EN.replace('{#second}', '{#Bad_Id}') }) })).toThrow(ContentError);
  });

  it('returns null without an English file', () => {
    expect(getFaq('en-US', { root: makeContentRoot({}) })).toBeNull();
  });

  it('the real files have the same nine question ids and topic ids in both locales', () => {
    const en = getFaq('en-US')!;
    const de = getFaq('de-DE')!;
    expect(en.topics.flatMap((t) => t.items)).toHaveLength(9);
    expect(de.page.fallback).toBe(false);
    expect(de.topics.flatMap((t) => t.items).every((i) => !i.fallback)).toBe(true);
    expect(de.topics.map((t) => t.id)).toEqual(en.topics.map((t) => t.id));
  });
});
