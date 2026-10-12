import { setRequestLocale } from 'next-intl/server';
import { ContentoolsWrapper } from '@/components/contentools/ContentoolsWrapper';
import { EditorBoundary } from '@/components/contentools/EditorBoundary';
import { getValidContentoolsJwt } from '@/lib/contentools/jwt';
import { getProjectKey } from '@/lib/contentools/project-key';
import { getPortalSession } from '@/lib/portal/viewer';

/**
 * Content editors (workstream U-08, decisions 4 and 6). The first segment picks the tab (`blocks` is the content-blocks manager,
 * anything else is Pages); each manager mounts its own router with the tab path as basename, so deep editor paths (`.../edit`) land
 * here too. The Contentools token stays on the server: only a boolean goes to the client.
 */
export default async function ContentEditorPage({ params }: { params: Promise<{ locale: string; slug: string[] }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const blocks = slug[0] === 'blocks';
  const session = await getPortalSession();
  const connected = (await getValidContentoolsJwt()) !== null;
  return (
    <EditorBoundary>
      <ContentoolsWrapper
        tab={blocks ? 'items' : 'pages'}
        parentUrl={`/${locale}/content/${blocks ? 'blocks' : 'pages'}`}
        locale={locale}
        storeKey={session.storeKey ?? null}
        connected={connected}
        projectKey={getProjectKey()}
      />
    </EditorBoundary>
  );
}
