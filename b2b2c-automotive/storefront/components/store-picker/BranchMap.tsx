// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

// Leaflet and its CSS are imported only here; the picker loads this file with next/dynamic and ssr: false.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { MAP_MAX_ZOOM, OSM_ATTRIBUTION, OSM_TILE_URL } from '@/components/store-picker/map-config';
import type { LatLng } from '@/lib/geo/distance';
import type { BranchView } from '@/lib/types';

/** What the map needs of a place: a `BranchView` fits, and so does a Malva reseller. */
export type MapPlace = Pick<BranchView, 'key' | 'name' | 'geo'>;

interface Props {
  branches: MapPlace[];
  focusedKey: string | null;
  onFocus: (key: string) => void;
  /** A searched place or the shopper's position: the map recentres on it. */
  center: LatLng | null;
}

// Pins are divIcons (no marker image files, so the bundler has no default image path to break).
const pin = (focused: boolean) =>
  L.divIcon({
    className: '',
    html: `<span class="block size-4 rounded-full border-2 border-surface shadow-card ${focused ? 'bg-action ring-4 ring-action-subtle' : 'bg-text-muted'}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
const ICONS = { focused: pin(true), idle: pin(false) };

function Controller({ points, focused, center }: { points: LatLng[]; focused: LatLng | null; center: LatLng | null }) {
  const map = useMap();
  // Fit all branches once; later changes pan or recentre.
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [32, 32], maxZoom: 12 });
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit on mount only
  }, [map]);
  useEffect(() => {
    if (focused) map.panTo([focused.lat, focused.lng]);
  }, [map, focused]);
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], Math.max(map.getZoom(), 9));
  }, [map, center]);
  return null;
}

export default function BranchMap({ branches, focusedKey, onFocus, center }: Props) {
  const located = useMemo(() => branches.filter((b): b is MapPlace & { geo: LatLng } => Boolean(b.geo)), [branches]);
  const points = useMemo(() => located.map((b) => b.geo), [located]);
  const focusedBranch = located.find((b) => b.key === focusedKey);
  const start = points[0] ?? { lat: 51.16, lng: 10.45 };
  return (
    <MapContainer center={[start.lat, start.lng]} zoom={6} maxZoom={MAP_MAX_ZOOM} scrollWheelZoom className="h-full min-h-64 w-full">
      <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} maxZoom={MAP_MAX_ZOOM} />
      {located.map((b) => (
        <Marker
          key={b.key}
          position={[b.geo.lat, b.geo.lng]}
          icon={b.key === focusedKey ? ICONS.focused : ICONS.idle}
          zIndexOffset={b.key === focusedKey ? 1000 : 0}
          title={b.name}
          alt={b.name}
          eventHandlers={{ click: () => onFocus(b.key) }}
        />
      ))}
      <Controller points={points} focused={focusedBranch?.geo ?? null} center={center} />
    </MapContainer>
  );
}
