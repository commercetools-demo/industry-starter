// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ReviewDraft } from '@commercetools/platform-sdk';
import { keyOfSku } from './items';

/**
 * Product reviews (Q-L01): "Top rated" sorts on `reviewRatingStatistics`, the rating row on the listing and the review
 * summary on the detail page read it. Plain `Review` resources without a state (no approval gate, Q-004), so the platform
 * counts them in the statistics. Rating is 1 to 5 stars (the scale workstream V writes too). Authors are synthetic.
 * Only parts carried by BOTH resellers are reviewed, so every store shows ratings. Keys are `mau-rev-<sku>-<n>`.
 */
export interface ReviewDef { sku: string; n: number; author: string; rating: 1 | 2 | 3 | 4 | 5; locale: 'de-DE' | 'en-US'; title: string; text: string }

const R = (sku: string, n: number, author: string, rating: ReviewDef['rating'], locale: ReviewDef['locale'], title: string, text: string): ReviewDef => ({ sku, n, author, rating, locale, title, text });

export const REVIEWS: ReviewDef[] = [
  R('MLV-BP-41001', 1, 'Lena K.', 5, 'de-DE', 'Leise und bissig', 'Passt perfekt am Golf, kaum Staub und keine Geräusche.'),
  R('MLV-BP-41001', 2, 'Marc T.', 5, 'en-US', 'Great stopping power', 'Fitted in an hour, noticeably better bite than the old pads.'),
  R('MLV-BP-41001', 3, 'Jule S.', 4, 'de-DE', 'Gut, etwas teuer', 'Qualität stimmt, der Preis ist im oberen Bereich.'),
  R('MLV-OF-44001', 1, 'Tim H.', 4, 'en-US', 'Does the job', 'Standard quality oil filter, fits as described.'),
  R('MLV-OF-44001', 2, 'Anja R.', 5, 'de-DE', 'Immer wieder', 'Bestelle ich per Abo, nie Probleme.'),
  R('MLV-OF-44002', 1, 'Paul W.', 5, 'de-DE', 'Passgenau', 'Für den 2.0 TDI genau richtig, Dichtung lag bei.'),
  R('MLV-OF-44002', 2, 'Chris D.', 4, 'en-US', 'Solid filter', 'No leaks, good value.'),
  R('MLV-EO-62001', 1, 'Sofia B.', 5, 'de-DE', 'Läuft rund', 'Motor läuft ruhiger, Lieferung am nächsten Tag.'),
  R('MLV-EO-62001', 2, 'Ben F.', 5, 'en-US', 'Best price per litre', 'Meets the spec of my car, very happy.'),
  R('MLV-EO-62001', 3, 'Kai M.', 5, 'de-DE', 'Top Öl', 'Seit Jahren im Einsatz, keine Beanstandung.'),
  R('MLV-EO-62001', 4, 'Nina P.', 4, 'en-US', 'Good', 'Packaging could be better, the oil is fine.'),
  R('MLV-WW-64001', 1, 'Olaf G.', 4, 'de-DE', 'Streifenfrei', 'Wischt sauber, Montage in wenigen Minuten.'),
  R('MLV-WW-64001', 2, 'Ruth N.', 3, 'en-US', 'Okay', 'Works, a little noisy at speed.'),
  R('MLV-WW-64001', 3, 'Jan L.', 4, 'de-DE', 'Preis-Leistung', 'Für den Preis völlig in Ordnung.'),
  R('MLV-BT-54001', 1, 'Eva C.', 5, 'de-DE', 'Springt sofort an', 'Auch bei Frost startet der Wagen zuverlässig.'),
  R('MLV-BT-54001', 2, 'Sam V.', 4, 'en-US', 'Reliable', 'Easy swap, core charge refunded as promised.'),
  R('MLV-BT-54001', 3, 'Uwe Z.', 4, 'de-DE', 'Solide', 'Kein Grund zur Klage.'),
  R('MLV-AF-45001', 1, 'Mona E.', 3, 'de-DE', 'Passt, mehr nicht', 'Funktioniert, Verarbeitung nur durchschnittlich.'),
  R('MLV-AF-45001', 2, 'Dan Q.', 4, 'en-US', 'Fine', 'Fits the Golf and filters well.'),
  R('MLV-CF-46001', 1, 'Gisela A.', 2, 'de-DE', 'Geruch bleibt', 'Aktivkohle merkt man kaum, Pollen werden gefiltert.'),
  R('MLV-CF-46001', 2, 'Tom Y.', 4, 'en-US', 'Cleaner cabin air', 'Noticeably less dust, easy to fit.'),
  R('MLV-BD-42001', 1, 'Hanna O.', 5, 'de-DE', 'Hervorragend', 'Rundlauf einwandfrei, kein Rubbeln.'),
];

export const reviewKey = (sku: string, n: number): string => `mau-rev-${sku.toLowerCase()}-${n}`;

export const reviewDrafts = (): ReviewDraft[] =>
  REVIEWS.map((r) => ({
    key: reviewKey(r.sku, r.n), uniquenessValue: reviewKey(r.sku, r.n), authorName: r.author, title: r.title, text: r.text, rating: r.rating, locale: r.locale,
    target: { typeId: 'product' as const, key: keyOfSku(r.sku) },
  }));

export const reviewedSkus = (): string[] => [...new Set(REVIEWS.map((r) => r.sku))];
