import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

export const alt = 'Malva Plumbing & Waste Management';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#173A5F', color: '#fff' }}>
        <div style={{ fontSize: 40, fontWeight: 700, marginBottom: 32 }}>Malva</div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{t('heroTitle')}</div>
      </div>
    ),
    size,
  );
}
