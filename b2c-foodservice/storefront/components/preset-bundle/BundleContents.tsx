'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { transformThumbnailImageUrl } from '@/lib/ct/image-config';
import type { BundleComponentView, BundleMachineOption, BundlePresetView } from '@/lib/types';

/** "What's in the box": the names of every product of the chosen preset, each with its own product page (workstream V, D9). */
export default function BundleContents({ preset, machine }: { preset: BundlePresetView; machine: BundleMachineOption | undefined }) {
  const t = useTranslations('presetBundle');
  const defaultMachine = preset.components.find((c) => c.role === 'machine');
  const pods = preset.components.filter((c) => c.role === 'item');
  const rows: { key: string; name: string; imageUrl?: string; href?: string }[] = [
    {
      key: machine?.sku ?? 'machine',
      name: machine?.imageAlt ?? defaultMachine?.name ?? '',
      ...(machine?.imageUrl ? { imageUrl: machine.imageUrl } : {}),
      ...(defaultMachine && machine?.sku === defaultMachine.sku ? { href: productHref(defaultMachine) } : {}),
    },
    ...pods.map((p: BundleComponentView) => ({ key: p.sku, name: p.name, ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}), href: productHref(p) })),
  ];
  return (
    <section className="mt-6" aria-labelledby="bundle-contents">
      <h2 id="bundle-contents" className="section-title m-0 text-[18px]">{t('inTheBox')}</h2>
      <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3">
            <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-field bg-canvas-2">
              {row.imageUrl ? <Image src={transformThumbnailImageUrl(row.imageUrl)} alt="" fill sizes="48px" className="object-cover" /> : null}
            </span>
            {row.href ? (
              <Link href={row.href} className="text-[14.5px] font-semibold text-ink no-underline hover:underline">{row.name}</Link>
            ) : (
              <span className="text-[14.5px] font-semibold text-ink">{row.name}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function productHref(c: BundleComponentView): string {
  return `/p/${encodeURIComponent(c.slug)}/${encodeURIComponent(c.sku)}`;
}
