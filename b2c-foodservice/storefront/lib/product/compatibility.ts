import { CAPSULE_SYSTEMS } from '@/lib/product/variant-config';

/**
 * Capsule and machine compatibility (workstream H, 3.7, Q-H-13). Original capsules fit Original machines and Vertuo
 * capsules fit Vertuo machines; the two are not interchangeable. Bean-to-cup, espresso and filter machines take none.
 * Both arguments are `system` enum keys. Pure; used by the bundle selector and the "Goes well with" strip.
 */
export function podsFitMachine(machineSystem: string | undefined, podSystem: string | undefined): boolean {
  if (!machineSystem || !podSystem) return false;
  return CAPSULE_SYSTEMS.includes(machineSystem) && machineSystem === podSystem;
}

/** True when the machine takes capsules at all. */
export function machineTakesCapsules(machineSystem: string | undefined): boolean {
  return Boolean(machineSystem && CAPSULE_SYSTEMS.includes(machineSystem));
}

/**
 * Whether a bundle option is offered for a machine. A bundle with starter capsules makes no sense for a machine that
 * takes none, so it is rendered disabled instead of being offered and rejected at the cart.
 */
export function bundleOffered(machineSystem: string | undefined, bundleKey: string): boolean {
  if (bundleKey === 'starter-capsules') return machineTakesCapsules(machineSystem);
  return true;
}
