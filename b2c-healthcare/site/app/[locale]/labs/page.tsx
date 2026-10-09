import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';

type Props = { params: Promise<{ locale: string }> };

// `/labs` is the prototype's alias of `/account/labs`. The target sits under the (protected) group, so a signed-out
// visitor lands on the sign-in prompt for `/account/labs`, not on patient data.
export default async function LabsAlias({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect({ href: '/account/labs', locale });
}
