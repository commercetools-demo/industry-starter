import { useTranslations } from 'next-intl';

/** Same geometry as the loaded page (5:6 gallery block beside text lines), so nothing jumps when the data arrives. */
export default function ProductLoading() {
  const t = useTranslations('plp');
  return (
    <div className="wrap pb-16 pt-3.5" aria-busy="true">
      <p className="sr-only" role="status">{t('loading')}</p>
      <div className="h-5 w-56 rounded-field bg-canvas-2" />
      <div className="mt-3.5 grid gap-x-12 gap-y-8 stack:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="aspect-[5/6] w-full rounded-panel bg-canvas-2" />
        <div className="flex flex-col gap-4">
          <div className="h-3 w-24 rounded-field bg-canvas-2" />
          <div className="h-9 w-3/4 rounded-field bg-canvas-2" />
          <div className="h-6 w-32 rounded-field bg-canvas-2" />
          <div className="h-4 w-full rounded-field bg-canvas-2" />
          <div className="h-12 w-full rounded-field bg-canvas-2" />
          <div className="h-24 w-full rounded-card bg-canvas-2" />
          <div className="h-14 w-full rounded-pill bg-canvas-2" />
        </div>
      </div>
    </div>
  );
}
