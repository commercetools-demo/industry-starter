import { notFound } from 'next/navigation';
import type { AbstractIntlMessages } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import Showcase from '@/components/assistant/cards/Showcase';
import { SHOWCASE_LOCALES, type ShowcaseLocale } from '@/components/assistant/fixtures';

type Props = { params: Promise<{ brand?: string; locale: string }> };

export const dynamic = 'force-dynamic';

/** Every assistant card in every slot state (workstream T). A 404 unless ASSISTANT_SHOWCASE is 'true' (a runtime variable, never NEXT_PUBLIC_). */
export default async function AssistantShowcasePage({ params }: Props) {
  if (process.env.ASSISTANT_SHOWCASE !== 'true') notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  // Both markets render side by side, each with its own catalogue's card strings.
  const messages = {} as Record<ShowcaseLocale, AbstractIntlMessages>;
  for (const l of SHOWCASE_LOCALES) {
    const all = (await getMessages({ locale: l })) as { assistant?: { cards?: AbstractIntlMessages } };
    messages[l] = { assistant: { cards: all.assistant?.cards ?? {} } };
  }
  return <Showcase messages={messages} />;
}
