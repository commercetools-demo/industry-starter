import { PREFIX } from '../lib';
import { DOCTORS, doctorKey, type DoctorDef } from './doctors';

/** 3 to 6 synthetic reviews per doctor; all from verified patients. Ratings roll up into the product's `reviewRatingStatistics`. */
export const REVIEW_TYPE_KEY = `${PREFIX}review-meta`;

const SNIPPETS: [title: string, text: string][] = [
  ['Clear and kind', 'Explained everything in plain language and answered every question without rushing.'],
  ['Felt listened to', 'I never felt hurried. The plan we agreed on was easy to follow.'],
  ['Easy to book', 'Booking was quick and the session started on time.'],
  ['Thorough', 'Went through my history carefully and followed up with a written summary.'],
  ['Would recommend', 'Practical advice, a calm manner and a useful follow-up plan.'],
  ['Good value', 'Worth the fee: focused, well prepared and respectful of my time.'],
];

const AUTHORS = ['Verified patient', 'Verified patient, New York', 'Verified patient, Austin', 'Verified patient, Chicago', 'Verified patient', 'Verified patient'];

/** Ratings per doctor (index = doctor order in DOCTORS); the length is the review count (3 to 6). */
const RATINGS: number[][] = [
  [5, 5, 5, 4, 5],
  [5, 4, 5, 5],
  [5, 5, 5],
  [5, 5, 4, 5, 5],
  [5, 5, 5, 4, 5, 5],
  [4, 5, 4, 5],
  [5, 5, 5, 4],
  [5, 4, 5, 4, 5],
];

export interface ReviewSeed { key: string; doctorKey: string; rating: number; title: string; text: string; authorName: string }

export const REVIEWS: ReviewSeed[] = DOCTORS.flatMap((d, n) =>
  RATINGS[n].map((rating, i) => ({
    key: reviewKey(d, i + 1),
    doctorKey: doctorKey(d),
    rating,
    title: SNIPPETS[(n + i) % SNIPPETS.length][0],
    text: SNIPPETS[(n + i) % SNIPPETS.length][1],
    authorName: AUTHORS[(n + i) % AUTHORS.length],
  })),
);

function reviewKey(d: DoctorDef, i: number) {
  return `${PREFIX}rev-${d.slug}-${i}`;
}

export function reviewDraft(r: ReviewSeed) {
  return {
    key: r.key,
    target: { typeId: 'product', key: r.doctorKey },
    rating: r.rating,
    title: r.title,
    text: r.text,
    authorName: r.authorName,
    locale: 'en-US',
    custom: { type: { typeId: 'type', key: REVIEW_TYPE_KEY }, fields: { verifiedPatient: true } },
  };
}
