import type { Localized } from '@/lib/content/localized';

// DRAFT: placeholder story and values written for the demo. No statistics, awards or certifications are claimed.
// The owner approves or rewrites every line (SO-P2) before release.

export interface AboutValue {
  icon: 'leaf' | 'bean' | 'shield';
  title: string;
  text: string;
}

export interface AboutContent {
  eyebrow: string;
  title: string;
  intro: string;
  metaDescription: string;
  story: string[];
  values: AboutValue[];
  recycling: { title: string; text: string };
  store: { title: string; text: string };
  closing: { title: string; text: string };
}

export const ABOUT: Localized<AboutContent> = {
  'en-US': {
    eyebrow: 'Our story',
    title: 'Coffee, made simple.',
    intro: 'Malva Coffee is an online coffee shop for people who want a great cup at home without the fuss.',
    metaDescription: 'Meet Malva Coffee: how we choose, roast and deliver coffee and capsules to the United States and Canada.',
    story: [
      'We started Malva with a small idea: good coffee should be easy to find and easy to make. We sell whole beans, capsules that work with popular machines, and the machines and accessories to go with them.',
      'Everything is ordered online. Orders ship across the United States and Canada, and in New York City you can also collect your order from one of our stores.',
      'We would rather tell you what we know than make big claims. If you want to know where a coffee comes from or how it is roasted, ask us and we will answer plainly.',
    ],
    values: [
      { icon: 'leaf', title: 'Sourcing', text: 'We buy from producers we can name and we say so on the product page.' },
      { icon: 'bean', title: 'Roasting', text: 'Small batches, roasted to order so the coffee reaches you fresh.' },
      { icon: 'shield', title: 'Quality guarantee', text: 'If a coffee is not right, tell us. We will make it right or refund you.' },
    ],
    recycling: {
      title: 'Capsule recycling',
      text: 'Our capsules are compatible with popular machines. We are working on a take-back option for used capsules and will publish the details here when it is ready.',
    },
    store: { title: 'Visit a store', text: 'Collect your order in New York City, ready in minutes.' },
    closing: { title: 'Ready for a good cup?', text: 'Browse the shop, or tell us what you are looking for.' },
  },
};
