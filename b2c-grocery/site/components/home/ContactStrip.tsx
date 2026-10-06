import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Blob } from '@/components/ui/Blob';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

/** "Questions? Contact us": outlined strip with a 64 px blob and chat icon. The caller omits it entirely when switched off. */
export function ContactStrip() {
  const t = useTranslations('home.contact');
  return (
    <section data-section="contact" className="flex flex-col items-start gap-(--space-6) rounded-[calc(var(--radius-lg)*1.4)] border border-divider p-[35px] tablet:flex-row tablet:items-center">
      <div className="relative size-16 flex-none">
        <Blob className="size-full" />
        <Icon icon={MessageCircle} size={26} className="absolute inset-0 m-auto text-accent-2-800" />
      </div>
      <div className="flex-1">
        <h3 className="m-0 text-[24px]">{t('title')}</h3>
        <p className="mt-(--space-1) mb-0 text-[15px] text-text/72">{t('body')}</p>
      </div>
      <Button href="/contact">{t('button')}</Button>
    </section>
  );
}
