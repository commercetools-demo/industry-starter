import type { Block } from '@/lib/content/blocks';
import type { Localized } from '@/lib/content/localized';
import type { PolicySlug } from '@/lib/routes';

export interface PolicyText {
  title: string;
  /** ISO calendar day. It lives inside the text object so the date always moves with the text it describes. */
  effectiveDate: string;
  /** True while the text is placeholder copy. The owner or legal sets false per policy (SO-01). */
  isDraft: boolean;
  metaDescription: string;
  body: Block[];
}

// DRAFT: every policy below is placeholder copy for the demo, written neutrally for the United States and Canada.
// It is not legal advice. US state and Canadian federal privacy and consumer-law wording is supplied by the owner or legal (SO-01).
// There is no imprint, no VAT text and no email promise: the shop sends no confirmation, reset or marketing email (D-032).

const SHIPPING_RETURNS: PolicyText = {
  title: 'Shipping and returns',
  effectiveDate: '2026-10-01',
  isDraft: true,
  metaDescription: 'How Malva Coffee delivers to the United States and Canada, how collection works in New York City, and how returns and refunds work.',
  body: [
    { type: 'h2', id: 'delivery', text: 'Delivery' },
    { type: 'p', text: 'We deliver to addresses in the United States and Canada. The delivery options and prices you see at checkout are the ones that apply to your address.' },
    { type: 'p', text: 'Delivery is free on orders over {{freeShipping}}. Below that, the delivery price is shown before you pay.' },
    { type: 'ul', items: ['United States: delivery to your address, or collection in store (see below).', 'Canada: delivery only. Collection in store is not available.', 'Orders are packed after you place them. You can follow an order from your account.'] },
    { type: 'h2', id: 'collection', text: 'Collection in store' },
    { type: 'p', text: 'Collection is available at our stores in New York City, for customers shopping in the United States. When an item is in stock at your store, your order is usually ready in {{collectMinutes}}.' },
    { type: 'p', text: 'Bring the order number from your confirmation page and a photo ID if we ask for one.' },
    { type: 'h2', id: 'returns', text: 'Returns' },
    { type: 'p', text: 'You can return an unopened item within {{returnDays}} of receiving it. If a product arrives damaged or is not what you ordered, tell us as soon as you can and we will put it right.' },
    { type: 'ol', items: ['Contact us with your order number.', 'We tell you where to send the item.', 'We refund the original payment once the item reaches us.'] },
    { type: 'p', text: 'Opened coffee and used capsules cannot be returned unless they are faulty.' },
    { type: 'h2', id: 'refunds', text: 'Refunds' },
    { type: 'p', text: 'Refunds go back to the payment method you used. Your bank decides how long it takes to show.' },
    { type: 'note', text: 'Questions about a delivery or a return? Write to {{supportEmail}} or call {{supportPhone}}.' },
  ],
};

const TERMS: PolicyText = {
  title: 'Terms of sale',
  effectiveDate: '2026-10-01',
  isDraft: true,
  metaDescription: 'The terms that apply when you buy from Malva Coffee.',
  body: [
    { type: 'h2', id: 'about-terms', text: 'About these terms' },
    { type: 'p', text: 'These terms apply to purchases made on this website. By placing an order you agree to them.' },
    { type: 'h2', id: 'orders', text: 'Orders and prices' },
    { type: 'p', text: 'Prices are shown in US dollars in the United States and in Canadian dollars in Canada. An order is accepted when we confirm it on the confirmation page. We may cancel an order if an item is unavailable or a price was shown by mistake, and we will refund anything you paid.' },
    { type: 'h2', id: 'payment', text: 'Payment' },
    { type: 'p', text: 'You pay through our hosted checkout. Card details are handled by the payment provider and never reach Malva Coffee.' },
    { type: 'h2', id: 'subscriptions', text: 'Subscriptions' },
    { type: 'p', text: 'A subscription repeats an order on the schedule you choose until you pause or cancel it from your account. You can skip or cancel before the next order is prepared.' },
    { type: 'h2', id: 'delivery-returns', text: 'Delivery and returns' },
    { type: 'p', text: 'Delivery and returns follow our shipping and returns page. Your statutory rights are not affected.' },
    { type: 'h2', id: 'liability', text: 'Liability' },
    { type: 'p', text: 'Nothing in these terms limits our liability where the law does not allow it. Capsules are compatible with popular machines; we are not affiliated with any machine maker.' },
    { type: 'h2', id: 'law', text: 'Governing law' },
    { type: 'p', text: 'The governing law and the place where disputes are heard are set out by the owner and legal before release.' },
    { type: 'note', text: 'Questions about these terms? Write to {{supportEmail}}.' },
  ],
};

const PRIVACY: PolicyText = {
  title: 'Privacy policy',
  effectiveDate: '2026-10-01',
  isDraft: true,
  metaDescription: 'What Malva Coffee collects, why, and how you can see, correct or delete it.',
  body: [
    { type: 'h2', id: 'what-we-collect', text: 'What we collect' },
    { type: 'ul', items: ['Account details: your name, email address and saved addresses.', 'Orders: what you bought, where it was sent and the order status.', 'Reviews you choose to write.', 'Messages you send us through the contact form.'] },
    { type: 'h2', id: 'payments', text: 'Payments' },
    { type: 'p', text: 'Payment is handled by the hosted checkout and its payment provider. Card data never touches Malva Coffee, and we do not store it.' },
    { type: 'h2', id: 'cookies', text: 'Cookies' },
    { type: 'p', text: 'We use two cookies, and both are essential. One keeps you signed in and keeps your bag. The other remembers your country and language. We do not use analytics or advertising cookies, and we load no third-party scripts.' },
    { type: 'h2', id: 'how-we-use', text: 'How we use it' },
    { type: 'p', text: 'We use your details to take and deliver orders, to run your account, and to answer your messages. We do not send email: there are no confirmation, reset or marketing emails at present.' },
    { type: 'h2', id: 'retention', text: 'How long we keep it' },
    { type: 'p', text: 'We keep order records as long as the law requires. Account details stay until you delete your account.' },
    { type: 'h2', id: 'your-rights', text: 'Your choices' },
    { type: 'p', text: 'You can see and correct your details in your account, and you can ask us to delete your account. The rights that apply to you depend on where you live; the owner and legal complete this section before release.' },
    { type: 'note', text: 'Privacy questions? Write to {{supportEmail}}.' },
  ],
};

const ACCESSIBILITY: PolicyText = {
  title: 'Accessibility statement',
  effectiveDate: '2026-10-01',
  isDraft: true,
  metaDescription: 'Our commitment to an accessible Malva Coffee website, known gaps and how to tell us about a problem.',
  body: [
    { type: 'h2', id: 'commitment', text: 'Our commitment' },
    { type: 'p', text: 'We want everyone to be able to use this shop. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2, level AA.' },
    { type: 'h2', id: 'what-we-do', text: 'What we do' },
    { type: 'ul', items: ['Every page can be used with a keyboard, with a visible focus ring.', 'Pages use headings, landmarks and labels so a screen reader can follow them.', 'Text and controls meet colour contrast targets, and motion respects the reduced motion setting.'] },
    { type: 'h2', id: 'known-gaps', text: 'Known gaps' },
    { type: 'p', text: 'This is a new site and we have not completed an independent audit. Some product images may have short descriptions. We list what we find here as we find it.' },
    { type: 'h2', id: 'tell-us', text: 'Tell us about a problem' },
    { type: 'p', text: 'If something does not work for you, write to {{supportEmail}} or call {{supportPhone}}. Tell us the page and what happened and we will help you complete your order another way.' },
    { type: 'cta', text: 'Contact us', href: '/contact' },
  ],
};

export const POLICIES: Record<PolicySlug, Localized<PolicyText>> = {
  'shipping-returns': { 'en-US': SHIPPING_RETURNS },
  terms: { 'en-US': TERMS },
  privacy: { 'en-US': PRIVACY },
  accessibility: { 'en-US': ACCESSIBILITY },
};
