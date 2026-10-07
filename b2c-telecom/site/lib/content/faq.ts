import { optionalString, parseFrontMatter, requireString } from './frontmatter';
import { readLocaleFile } from './files';
import { renderMarkdown, stripHtml } from './markdown';
import type { PageDoc } from './pages';
import { ContentError, FALLBACK_LOCALE, type ContentLocale, type ContentOptions } from './types';

export interface FaqItem {
  id: string;
  question: string;
  answerHtml: string;
  answerText: string;
  /** True when the text is served in English because the German text does not exist. */
  fallback: boolean;
}
export interface FaqTopic {
  id: string;
  title: string;
  items: FaqItem[];
}
export interface Faq {
  page: PageDoc;
  topics: FaqTopic[];
}

interface RawQuestion {
  id: string;
  question: string;
  answerMd: string;
}
interface RawTopic {
  id: string;
  title: string;
  questions: RawQuestion[];
}

const HEADING = /^(#{2,3})\s+(.*?)\s*$/;
const ID_SUFFIX = /\s*\{#([^}]*)\}\s*$/;
const ID_PATTERN = /^[a-z0-9-]+$/;

/** Splits the markdown body into topics (`## Title {#id}`) and questions (`### Question {#id}`). */
function parseTopics(body: string, file: string): RawTopic[] {
  const topics: RawTopic[] = [];
  const seen = new Set<string>();
  let topic: RawTopic | null = null;
  let question: RawQuestion | null = null;
  const answer: string[] = [];

  const closeQuestion = () => {
    if (question) question.answerMd = answer.join('\n').trim();
    answer.length = 0;
    question = null;
  };

  for (const line of body.split('\n')) {
    const heading = HEADING.exec(line);
    if (!heading) {
      if (question) answer.push(line);
      continue;
    }
    closeQuestion();
    const idMatch = ID_SUFFIX.exec(heading[2]);
    const title = heading[2].replace(ID_SUFFIX, '').trim();
    if (!idMatch || !ID_PATTERN.test(idMatch[1])) throw new ContentError(`${file}: heading "${heading[2]}" needs an {#id} of [a-z0-9-]`);
    const id = idMatch[1];
    if (seen.has(id)) throw new ContentError(`${file}: duplicate id "${id}"`);
    seen.add(id);
    if (heading[1] === '##') {
      topic = { id, title, questions: [] };
      topics.push(topic);
    } else {
      if (!topic) throw new ContentError(`${file}: question "${id}" is not inside a topic`);
      question = { id, question: title, answerMd: '' };
      topic.questions.push(question);
    }
  }
  closeQuestion();
  return topics;
}

function toItem(raw: RawQuestion, locale: ContentLocale, fallback: boolean): FaqItem {
  const answerHtml = renderMarkdown(raw.answerMd, locale);
  return { id: raw.id, question: raw.question, answerHtml, answerText: stripHtml(answerHtml), fallback };
}

/** The FAQ for a locale. Question ids and order come from the en-US file; German text is merged per question. */
export function getFaq(locale: ContentLocale, opts?: ContentOptions): Faq | null {
  const english = readLocaleFile(FALLBACK_LOCALE, 'faq.md', opts);
  if (!english) return null;
  const englishParsed = parseFrontMatter(english.raw);
  const englishTopics = parseTopics(englishParsed.body, english.file);

  const own = locale === FALLBACK_LOCALE ? null : readLocaleFile(locale, 'faq.md', opts);
  const ownParsed = own && !own.fallback ? parseFrontMatter(own.raw) : null;
  const ownTopics = ownParsed && own ? parseTopics(ownParsed.body, own.file) : [];
  const ownQuestions = new Map<string, RawQuestion>(ownTopics.flatMap((t) => t.questions.map((q) => [q.id, q] as const)));
  const ownTitles = new Map(ownTopics.map((t) => [t.id, t.title]));

  const topics: FaqTopic[] = englishTopics.map((topic) => ({
    id: topic.id,
    title: ownTitles.get(topic.id) ?? topic.title,
    items: topic.questions.map((q) => {
      const german = ownQuestions.get(q.id);
      return german ? toItem(german, locale, false) : toItem(q, FALLBACK_LOCALE, locale !== FALLBACK_LOCALE);
    }),
  }));

  const source = ownParsed && own ? { data: ownParsed.data, file: own.file } : { data: englishParsed.data, file: english.file };
  const page: PageDoc = {
    slug: 'faq',
    title: requireString(source.data, 'title', source.file),
    description: requireString(source.data, 'description', source.file),
    kicker: optionalString(source.data, 'kicker'),
    html: '',
    servedLocale: ownParsed ? locale : FALLBACK_LOCALE,
    fallback: locale !== FALLBACK_LOCALE && !ownParsed,
  };
  return { page, topics };
}
