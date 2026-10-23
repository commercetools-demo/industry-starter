import { createGateRoute } from '@ct-demos/demotools/tracker/server';
import { GATE_HOME_PATH } from '@/lib/gate';

export const { GET, POST } = createGateRoute({ homePath: GATE_HOME_PATH });
