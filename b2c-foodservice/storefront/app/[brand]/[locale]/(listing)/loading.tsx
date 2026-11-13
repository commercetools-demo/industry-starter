import { useTranslations } from 'next-intl';

/** Same geometry as the loaded page (sidebar column plus a grid of cards), so nothing jumps when the data arrives. */
export default function ListingLoading() {
  const t = useTranslations('plp');
  return (
    <div className="wrap py-10" aria-busy="true">
      <p className="sr-only" role="status">{t('loading')}</p>
      <div className="mb-6 h-10 w-64 rounded-field bg-canvas-2" />
      <div className="grid gap-10 stack:grid-cols-[244px_minmax(0,1fr)]">
        <div className="hidden flex-col gap-4 stack:flex">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-24 rounded-field bg-canvas-2" />
          ))}
        </div>
        <ul className="m-0 grid list-none grid-cols-2 gap-x-3.5 gap-y-[18px] p-0 xs:gap-x-6 xs:gap-y-7 grid3:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <div className="aspect-[5/6] rounded-card bg-canvas-2" />
              <div className="mt-3 h-4 w-3/4 rounded-field bg-canvas-2" />
              <div className="mt-2 h-4 w-1/3 rounded-field bg-canvas-2" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
