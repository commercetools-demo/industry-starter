import { redirect } from 'next/navigation';
import { DemoGate } from '@ct-demos/demotools/tracker';
import { GATE_HOME_PATH, isDemoGateOpen, siteIsOpen } from '@/lib/gate';

export const dynamic = 'force-dynamic';

export default async function GatePage() {
  if (await isDemoGateOpen()) redirect(GATE_HOME_PATH);
  const open = await siteIsOpen();
  return <DemoGate homePath={GATE_HOME_PATH} open={open} siteType="commerce" />;
}
