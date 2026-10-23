import type { Article } from '@/lib/content/journal-types';
import { article as brewABetterCup } from './brew-a-better-cup';
import { article as capsuleTakeBackPlan } from './capsule-take-back-plan';
import { article as descaleYourMachine } from './descale-your-machine';
import { article as fromTheRoastery } from './from-the-roastery';

/** The registry. Add an article by creating its file and listing it here. */
export const ARTICLES: Article[] = [brewABetterCup, descaleYourMachine, fromTheRoastery, capsuleTakeBackPlan];
