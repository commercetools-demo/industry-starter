// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { branches } from '@/test/shell-fixtures';

const captured = vi.hoisted(() => ({ tile: null as null | Record<string, unknown>, map: null as null | Record<string, unknown>, markers: [] as Record<string, unknown>[] }));
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
}));

import BranchMap from './BranchMap';
import { MAP_MAX_ZOOM, OSM_ATTRIBUTION, OSM_COPYRIGHT_URL, OSM_TILE_URL } from './map-config';

describe('Choose a store: the map', () => {
  it('map has the OSM attribution', () => {
    render(<BranchMap branches={branches} focusedKey={null} onFocus={() => {}} center={null} />);
    expect(captured.tile?.attribution).toBe(OSM_ATTRIBUTION);
    expect(OSM_ATTRIBUTION).toContain('OpenStreetMap');
    expect(OSM_ATTRIBUTION).toContain('contributors');
    expect(OSM_ATTRIBUTION).toContain(OSM_COPYRIGHT_URL);
    expect(OSM_COPYRIGHT_URL).toBe('https://www.openstreetmap.org/copyright');
  });
  it('tile host is only tile.openstreetmap.org', () => {
    render(<BranchMap branches={branches} focusedKey={null} onFocus={() => {}} center={null} />);
    expect(captured.tile?.url).toBe(OSM_TILE_URL);
    expect(new URL((captured.tile?.url as string).replace('{z}/{x}/{y}', '1/1/1')).host).toBe('tile.openstreetmap.org');
    expect(OSM_TILE_URL).not.toMatch(/key=|apikey|token/i);
    expect(captured.tile?.maxZoom).toBe(MAP_MAX_ZOOM);
    expect(MAP_MAX_ZOOM).toBe(19);
  });
  it('has one pin per branch with coordinates, titled with the branch name', () => {
    captured.markers.length = 0;
    const noGeo = { ...branches[0], key: 'no-geo', geo: undefined };
    render(<BranchMap branches={[...branches, noGeo]} focusedKey={branches[1].key} onFocus={() => {}} center={null} />);
    expect(captured.markers).toHaveLength(branches.length);
    expect(captured.markers.map((m) => m.title)).toEqual(branches.map((b) => b.name));
  });
  it('a pin click focuses its branch', () => {
    captured.markers.length = 0;
    const onFocus = vi.fn();
    render(<BranchMap branches={branches} focusedKey={null} onFocus={onFocus} center={null} />);
    (captured.markers[1].eventHandlers as { click: () => void }).click();
    expect(onFocus).toHaveBeenCalledWith(branches[1].key);
  });
});
