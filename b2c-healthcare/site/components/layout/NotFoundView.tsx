import { useTranslations } from 'next-intl';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export type NotFoundKind = 'page' | 'doctor' | 'medicine' | 'order' | 'generic';

/**
 * "Address resolves to nothing" card (error-pages). The default is the page-level 404 with routes
 * back; resources (doctor, order) get the short specific copy. A resource that belongs to another
 * patient uses the same copy as one that does not exist, so nothing is revealed.
 */
export function NotFoundView({ kind = 'page' }: { kind?: NotFoundKind }) {
  const t = useTranslations('errors');
  return (
    <div className="mx-auto max-w-content px-5 py-14 nav:px-8">
      <Card className="mx-auto grid max-w-110 gap-4" data-error-kind="not-found">
        {kind === 'page' ? (
          <>
            <div>
              <h1 className="font-display text-2xl font-semibold text-text-heading">{t('notFoundPage.title')}</h1>
              <p className="mt-1.5 text-sm text-neutral-600">{t('notFoundPage.body')}</p>
            </div>
            <div className="grid gap-2.5">
              <ButtonLink href="/" full>
                {t('notFoundPage.home')}
              </ButtonLink>
              <ButtonLink href="/doctors/remote" variant="outline" full>
                {t('notFoundPage.doctors')}
              </ButtonLink>
              <ButtonLink href="/prescriptions" variant="outline" full>
                {t('notFoundPage.prescriptions')}
              </ButtonLink>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold text-text-heading">
              {t(kind === 'doctor' ? 'doctorNotFound' : kind === 'medicine' ? 'medicineNotFound' : kind === 'order' ? 'orderNotFound' : 'notFoundShort')}
            </h1>
            <ButtonLink href={kind === 'doctor' ? '/doctors/remote' : kind === 'medicine' ? '/search' : '/'} full>
              {kind === 'doctor' || kind === 'medicine' ? t('backToSearch') : t('notFoundPage.home')}
            </ButtonLink>
          </>
        )}
      </Card>
    </div>
  );
}
