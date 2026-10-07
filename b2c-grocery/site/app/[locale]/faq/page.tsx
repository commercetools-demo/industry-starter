import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { FaqList } from '@/components/content/FaqList';
import { Container } from '@/components/layout/Container';
import { getPage } from '@/lib/content';
import { parseFaq } from '@/lib/faq';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const page = await getPage('faq', locale);
  return page ? { title: page.title, description: page.description } : {};
}

export default async function FaqPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const page = await getPage('faq', locale);
  if (!page) notFound();
  return (
    <Container className="pt-[35px] pb-(--space-8)">
      {page.kicker ? <p className="mb-(--space-1) text-[12px] tracking-[0.1em] text-accent-700 uppercase">{page.kicker}</p> : null}
      <h1 className="m-0 mb-(--space-6) text-[40px] leading-[1.05] tablet:text-[56px]">{page.title}</h1>
      <FaqList groups={parseFaq(page.markdown)} />
    </Container>
  );
}
