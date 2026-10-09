import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { NotAvailableInRegion } from '@/components/layout/NotAvailableInRegion';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatIsoDate } from '@/lib/format-date';
import { controlClassLabel } from '@/lib/funding/credential';
import { shelfLifeMonths } from '@/lib/dispense/rules';
import { formatMoney } from '@/lib/utils';
import type { MedicineDetail } from '@/lib/types';

/** Image gallery: every product image (the first large), or a token-styled placeholder when there is none. Server-rendered, no script. */
export function MedicineGallery({ medicine }: { medicine: MedicineDetail }) {
  const t = useTranslations('medicine');
  const urls = medicine.imageUrls.length > 0 ? medicine.imageUrls : medicine.imageUrl ? [medicine.imageUrl] : [];
  if (urls.length === 0) {
    return (
      <div
        data-image="placeholder"
        role="img"
        aria-label={t('noImage')}
        className="grid aspect-square w-full place-items-center rounded-lg bg-(image:--gradient-brand) font-display text-lg font-semibold text-navy-900"
      >
        <span aria-hidden="true">{medicine.strength}</span>
      </div>
    );
  }
  return (
    <section aria-label={t('gallery')} data-image="photo" className="grid gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-50">
        <Image src={urls[0]} alt={t('imageAlt', { name: medicine.name, n: 1, total: urls.length })} fill unoptimized priority sizes="(min-width: 56rem) 40vw, 100vw" className="object-cover" />
      </div>
      {urls.length > 1 ? (
        <ul className="m-0 grid list-none grid-cols-4 gap-3 p-0">
          {urls.slice(1).map((url, i) => (
            <li key={url} className="relative aspect-square overflow-hidden rounded-md bg-neutral-50">
              <Image src={url} alt={t('imageAlt', { name: medicine.name, n: i + 2, total: urls.length })} fill unoptimized sizes="10rem" className="object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Stock and short-dated notice; nothing when stock could not be read. */
function Availability({ medicine }: { medicine: MedicineDetail }) {
  const t = useTranslations('medicine.stock');
  const locale = useLocale();
  const a = medicine.availability;
  if (!a) return null;
  const date = a.expiryDate ? formatIsoDate(a.expiryDate, locale) : '';
  const price = a.shortDatedPrice ? formatMoney(a.shortDatedPrice.centAmount, a.shortDatedPrice.currencyCode, locale) : '';
  return (
    <div data-availability={a.status} className="grid gap-1.5">
      <h2 className="font-meta text-sm font-bold text-neutral-600">{t('title')}</h2>
      <p>
        <Badge variant={a.status === 'in-stock' ? 'ok' : a.status === 'short-dated' ? 'wait' : 'no'}>
          {t(a.status)}
        </Badge>
      </p>
      {a.status === 'short-dated' ? <p className="text-sm text-neutral-700">{t('note-short-dated', { date, price })}</p> : null}
      {a.status === 'shelf-life' ? <p className="text-sm text-neutral-700">{a.expiryDate ? t('note-shelf-life', { date }) : t('note-shelf-life-undated')}</p> : null}
    </div>
  );
}

/** The main card of the page: title, badges, facts, price, availability, limits and the primary action. Public data only. */
export function MedicineSummary({ medicine }: { medicine: MedicineDetail }) {
  const t = useTranslations('medicine');
  const locale = useLocale();
  const months = shelfLifeMonths(medicine.minRemainingShelfLifeDays);
  const sellable = medicine.sellableInRegion !== false && medicine.price !== null;
  const facts: [string, string][] = [
    [t('strength'), medicine.strength],
    [t('form'), medicine.dosageForm],
    [t('pack'), medicine.dispenseUnit],
  ];
  return (
    <div className="grid gap-5">
      <Card className="grid gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-text-heading">{medicine.name}</h1>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Badge variant={medicine.rxOnly ? 'wait' : 'neutral'}>{medicine.rxOnly ? t('rxOnly') : t('otc')}</Badge>
            {medicine.hsaEligible ? <Badge variant="info">{t('hsa')}</Badge> : null}
          </div>
        </div>
        {medicine.description ? <p className="text-neutral-700">{medicine.description}</p> : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {facts
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="font-meta font-bold text-neutral-600">{label}</dt>
                <dd className="text-navy-900">{value}</dd>
              </div>
            ))}
        </dl>
        {medicine.controlClass ? (
          <p role="note" data-controlled className="rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-700">
            {t('controlled', { class: controlClassLabel(medicine.controlClass) })}
          </p>
        ) : null}
      </Card>
      {sellable && medicine.price ? (
        <Card as="section" aria-label={t('price')} className="grid gap-4">
          <p data-testid="medicine-price" className="font-display text-3xl font-semibold text-navy-900">
            {formatMoney(medicine.price.centAmount, medicine.price.currencyCode, locale)}
            <span className="ml-2 font-meta text-sm font-normal text-neutral-600">{t('perPack', { unit: medicine.dispenseUnit || 'pack' })}</span>
          </p>
          <Availability medicine={medicine} />
          <ul className="m-0 grid list-none gap-1 p-0 text-sm text-neutral-700">
            {medicine.maxQtyPerOrder ? <li data-testid="medicine-limit">{t('limit', { count: medicine.maxQtyPerOrder })}</li> : null}
            {months ? <li data-testid="medicine-shelf-life">{t('shelfLife', { months })}</li> : null}
          </ul>
          <p className="text-sm text-neutral-700">{medicine.rxOnly ? t('rxNotice') : t('otcNotice')}</p>
          <ButtonLink href="/prescriptions" full data-testid="medicine-cta">
            {medicine.rxOnly ? t('findOnRx') : t('orderFromRx')}
          </ButtonLink>
        </Card>
      ) : (
        <NotAvailableInRegion />
      )}
    </div>
  );
}
