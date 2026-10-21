import type { Block } from '@/lib/content/blocks';
import type { Localized } from '@/lib/content/localized';

export interface FaqItem {
  id: string;
  q: Localized<string>;
  a: Localized<Block[]>;
}
export interface FaqTopic {
  id: string;
  title: Localized<string>;
  items: FaqItem[];
}

// DRAFT: placeholder answers written for the demo. Figures use {{tokens}} so they match the promise bar.
// The owner approves or rewrites every answer (SO-P2). The subscription price answer follows the owner decision Q-N-1.

const p = (text: string): Block => ({ type: 'p', text });

export const FAQ_TOPICS: FaqTopic[] = [
  {
    id: 'ordering',
    title: { 'en-US': 'Ordering and delivery' },
    items: [
      {
        id: 'ordering-delivery-time',
        q: { 'en-US': 'How long does delivery take?' },
        a: { 'en-US': [p('We pack orders after you place them. You see the delivery options and the expected time for your address at checkout, and you can follow your order from your account.')] },
      },
      {
        id: 'ordering-shipping-cost',
        q: { 'en-US': 'What does shipping cost and when is it free?' },
        a: { 'en-US': [p('Delivery is free on orders over {{freeShipping}}. Below that, the price is shown at checkout before you pay. Prices differ for the United States and Canada.')] },
      },
      {
        id: 'ordering-change-cancel',
        q: { 'en-US': 'Can I change or cancel an order?' },
        a: { 'en-US': [p('Contact us as soon as you can with your order number. If the order has not been packed yet we will change or cancel it. If it has shipped, you can return it once it arrives.')] },
      },
    ],
  },
  {
    id: 'collecting',
    title: { 'en-US': 'Collecting in store' },
    items: [
      {
        id: 'collecting-how',
        q: { 'en-US': 'How does collection work?' },
        a: { 'en-US': [p('Choose a store, add what you want and pick collection at checkout. Collection is available at our New York City stores for customers shopping in the United States. In Canada we deliver only.')] },
      },
      {
        id: 'collecting-ready-time',
        q: { 'en-US': 'How long until my order is ready?' },
        a: { 'en-US': [p('When everything is in stock at your store, your order is usually ready in {{collectMinutes}}. The estimate for your store is shown before you pay.')] },
      },
      {
        id: 'collecting-what-to-bring',
        q: { 'en-US': 'What do I bring?' },
        a: { 'en-US': [p('Bring your order number from the confirmation page. We may ask for a photo ID.')] },
      },
      {
        id: 'collecting-unavailable',
        q: { 'en-US': 'Why is an item unavailable at my store?' },
        a: { 'en-US': [p('Each store has its own stock. If an item is not available at your store you can choose another store, or have it delivered.')] },
      },
    ],
  },
  {
    id: 'subscriptions',
    title: { 'en-US': 'Subscriptions' },
    items: [
      {
        id: 'subscriptions-how',
        q: { 'en-US': 'How do subscriptions work?' },
        a: { 'en-US': [p('Pick a product, choose how often you want it and subscribe. We send a new order on that schedule. You manage the schedule from your account.')] },
      },
      {
        id: 'subscriptions-skip-cancel',
        q: { 'en-US': 'Can I skip, pause or cancel?' },
        a: { 'en-US': [p('Yes. From your account you can skip the next order, pause the subscription or cancel it. Do it before the next order is prepared.')] },
      },
      {
        id: 'subscriptions-price',
        q: { 'en-US': 'Does the price change?' },
        a: { 'en-US': [p('The price shown when you subscribe applies to your orders. If a price changes we tell you in your account before it takes effect.')] },
      },
    ],
  },
  {
    id: 'capsules',
    title: { 'en-US': 'Capsules and machines' },
    items: [
      {
        id: 'capsules-compatible',
        q: { 'en-US': 'Are the capsules compatible with my machine?' },
        a: { 'en-US': [p('Our capsules are compatible with Nespresso Original or Vertuo machines, as marked on each product. They are independent products and are not made or endorsed by Nespresso. Check the machine type on the product page before you order.')] },
      },
      {
        id: 'capsules-grind',
        q: { 'en-US': 'Which grind should I choose?' },
        a: { 'en-US': [p('For an espresso machine choose fine. For a moka pot choose medium-fine. For a filter or press choose medium to coarse. Whole beans keep their flavour longest if you have a grinder.')] },
      },
      {
        id: 'capsules-descale',
        q: { 'en-US': 'How do I descale my machine?' },
        a: { 'en-US': [p('Follow the maker instructions for your machine and use a descaling product made for it. How often depends on how hard your water is; every three months is a common rule of thumb.')] },
      },
    ],
  },
  {
    id: 'returns',
    title: { 'en-US': 'Returns and payment' },
    items: [
      {
        id: 'returns-window',
        q: { 'en-US': 'What is the returns window?' },
        a: { 'en-US': [p('You can return an unopened item within {{returnDays}} of receiving it. Read the full details on our shipping and returns page.'), { type: 'cta', text: 'Shipping and returns', href: '/policies/shipping-returns' }] },
      },
      {
        id: 'returns-payment-methods',
        q: { 'en-US': 'Which payment methods are accepted?' },
        a: { 'en-US': [p('You pay through our hosted checkout. It shows the payment methods available for your order, including major credit and debit cards.')] },
      },
      {
        id: 'returns-payment-secure',
        q: { 'en-US': 'Is my payment secure?' },
        a: { 'en-US': [p('Yes. Payment is handled by the payment provider on a hosted page. Your card details never reach Malva Coffee.')] },
      },
    ],
  },
  {
    id: 'account',
    title: { 'en-US': 'Your account' },
    items: [
      {
        id: 'account-address',
        q: { 'en-US': 'How do I change my address?' },
        a: { 'en-US': [p('Sign in and open Addresses in your account. You can add, edit or remove addresses there. An order that has already shipped keeps its address.')] },
      },
      {
        id: 'account-delete',
        q: { 'en-US': 'How do I delete my account?' },
        a: { 'en-US': [p('Contact us from the contact page and ask us to delete your account. We remove your account details; we keep order records as long as the law requires.')] },
      },
    ],
  },
];

export function allFaqIds(topics: FaqTopic[] = FAQ_TOPICS): string[] {
  return topics.flatMap((t) => t.items.map((i) => i.id));
}
