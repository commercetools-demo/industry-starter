import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  LISTED_CABLE_500,
  LISTED_EQUIPMENT,
  LISTED_MESH,
  LISTED_ROUTER_AX3000,
} from '@/lib/listing/__fixtures__/catalog';
import type { CartLine } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { cartLine, cartOf } from './__fixtures__/cart';

const ctx = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/context/CartProvider', () => ({ useCartContext: () => ctx.value }));

import { EquipmentPicker } from './EquipmentPicker';

const addLine = vi.fn();
const removeLine = vi.fn();
const PLAN_LINE = cartLine({ id: 'plan-1', offerKey: LISTED_CABLE_500.key, kind: 'plan' });

function renderPicker(planLine: CartLine | null = PLAN_LINE, attached: CartLine[] = []) {
  return renderWithProviders(<EquipmentPicker plan={LISTED_CABLE_500} planLine={planLine ?? undefined} attached={attached} equipment={LISTED_EQUIPMENT} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  addLine.mockResolvedValue(null);
  ctx.value = { cart: cartOf([PLAN_LINE]), isLoading: false, itemCount: 0, addLine, removeLine };
});

describe('EquipmentPicker', () => {
  it('Equipment too slow for the plan: disabled with the reason, never hidden', () => {
    renderPicker();
    const slow = screen.getByRole('radio', { name: /Malva WiFi 5 Router AC1200 Rent/ });
    expect(slow).toBeDisabled();
    expect(screen.getByText('Supports up to 300 Mbps; Cable 500 delivers 500 Mbps.')).toBeInTheDocument();
  });

  it('equipment of the wrong technology is disabled with its reason', () => {
    renderPicker();
    expect(screen.getByRole('radio', { name: /5G Home Gateway/ })).toBeDisabled();
    expect(screen.getByText("Doesn't work with Cable 500.")).toBeInTheDocument();
  });

  it('shows rent and buy prices per variant', () => {
    renderPicker();
    expect(screen.getByRole('radio', { name: 'Malva WiFi 6 Router AX3000 Rent $8/mo' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'Malva WiFi 6 Router AX3000 Buy $129.99' })).toBeEnabled();
  });

  it('included equipment is one checked, disabled row that says "Included"', () => {
    renderPicker();
    const modem = screen.getAllByRole('radio', { name: /DOCSIS 3.1 Modem/ });
    expect(modem).toHaveLength(1);
    expect(modem[0]).toBeChecked();
    expect(modem[0]).toBeDisabled();
  });

  it('choosing a variant adds it under the plan line', async () => {
    renderPicker();
    await userEvent.click(screen.getByRole('radio', { name: 'Malva WiFi 6 Router AX3000 Rent $8/mo' }));
    expect(addLine).toHaveBeenCalledWith({ offerKey: LISTED_ROUTER_AX3000.key, sku: 'MLV-EQP-ROUTER-AX3000-RENT', quantity: 1, parentLineId: 'plan-1' });
  });

  it('choosing another router replaces the one of that kind in a single write', async () => {
    const attached = cartLine({ id: 'eq-1', offerKey: LISTED_ROUTER_AX3000.key, kind: 'equipment', sku: 'MLV-EQP-ROUTER-AX3000-RENT', parentLineId: 'plan-1' });
    renderPicker(PLAN_LINE, [attached]);
    expect(screen.getByRole('radio', { name: 'Malva WiFi 6 Router AX3000 Rent $8/mo' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: `${LISTED_MESH.name} Rent $12/mo` }));
    expect(addLine).toHaveBeenCalledWith({ offerKey: LISTED_MESH.key, sku: 'MLV-EQP-MESH-BE9300-RENT', quantity: 1, parentLineId: 'plan-1', replaceLineId: 'eq-1' });
    expect(removeLine).not.toHaveBeenCalled();
  });

  it('before the plan is chosen nothing can be picked', async () => {
    renderPicker(null);
    const ax = screen.getByRole('radio', { name: 'Malva WiFi 6 Router AX3000 Rent $8/mo' });
    expect(ax).toBeDisabled();
    await userEvent.click(ax);
    expect(addLine).not.toHaveBeenCalled();
  });
});
