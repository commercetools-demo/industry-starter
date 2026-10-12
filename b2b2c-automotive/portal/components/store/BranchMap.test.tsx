// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ tile: null as null | Record<string, unknown>, map: null as null | Record<string, unknown>, markers: [] as Record<string, unknown>[], clickHandlers: null as null | { click: (e: { latlng: { lat: number; lng: number } }) => void } }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('react-leaflet', () => ({
  MapContainer: (props: { children: ReactNode } & Record<string, unknown>) => {
    captured.map = props;
    return <div data-testid="leaflet">{props.children}</div>;
  },
  TileLayer: (props: Record<string, unknown>) => {
    captured.tile = props;
    return null;
  },
  Marker: (props: Record<string, unknown>) => {
    captured.markers.push(props);
    return null;
  },
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn(), panTo: vi.fn(), getZoom: () => 6 }),
  useMapEvents: (handlers: { click: (e: { latlng: { lat: number; lng: number } }) => void }) => {
    captured.clickHandlers = handlers;
    return null;
  },
}));

import BranchMap from './BranchMap';
import { MAP_MAX_ZOOM, OSM_ATTRIBUTION, OSM_TILE_URL } from './map-config';

const points = [
  { key: 'a', name: 'Wandsbek', lat: 53.57, lng: 10.07 },
  { key: 'b', name: 'Altona', lat: 53.55, lng: 9.93 },
];

describe('Branch map (Q-I02)', () => {
  it('has the OpenStreetMap attribution and only the OSM tile host', () => {
    render(<BranchMap points={points} label="Map of branches" />);
    expect(captured.tile?.attribution).toBe(OSM_ATTRIBUTION);
    expect(OSM_ATTRIBUTION).toContain('contributors');
    expect(new URL((captured.tile?.url as string).replace('{z}/{x}/{y}', '1/1/1')).host).toBe('tile.openstreetmap.org');
    expect(captured.tile?.maxZoom).toBe(MAP_MAX_ZOOM);
  });

  it('the map region has an accessible name and each pin is titled with the branch name', () => {
    captured.markers.length = 0;
    render(<BranchMap points={points} label="Map of branches" />);
    expect(screen.getByRole('region', { name: 'Map of branches' })).toBeTruthy();
    expect(captured.markers.map((m) => m.title)).toEqual(['Wandsbek', 'Altona']);
  });

  it('a pin click focuses its branch', () => {
    captured.markers.length = 0;
    const onFocus = vi.fn();
    render(<BranchMap points={points} label="Map" onFocus={onFocus} />);
    (captured.markers[1].eventHandlers as { click: () => void }).click();
    expect(onFocus).toHaveBeenCalledWith('b');
  });

  it('edit mode: a map click and a marker drag both report the position', () => {
    captured.markers.length = 0;
    const onPick = vi.fn();
    render(<BranchMap points={[]} label="Map" value={{ lat: 1, lng: 2 }} onPick={onPick} pinName="Branch position" />);
    captured.clickHandlers?.click({ latlng: { lat: 5, lng: 6 } });
    expect(onPick).toHaveBeenLastCalledWith(5, 6);
    const marker = captured.markers.find((m) => m.draggable);
    expect(marker?.title).toBe('Branch position');
    (marker?.eventHandlers as { dragend: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => void }).dragend({ target: { getLatLng: () => ({ lat: 7, lng: 8 }) } });
    expect(onPick).toHaveBeenLastCalledWith(7, 8);
  });
});

describe('map-config.ts stays a copy of the storefront file', () => {
  it('is identical to storefront/components/store-picker/map-config.ts', () => {
    const portal = readFileSync(path.join(process.cwd(), 'components/store/map-config.ts'), 'utf8');
    const storefront = readFileSync(path.join(process.cwd(), '../storefront/components/store-picker/map-config.ts'), 'utf8');
    expect(portal).toBe(storefront);
    expect(OSM_TILE_URL).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  });
});
