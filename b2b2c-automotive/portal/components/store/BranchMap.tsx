'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Leaflet and OpenStreetMap map of Store & channels (workstream U-05, decision 22, Q-I02). Same tiles, attribution and zoom limits as
// the storefront store picker (map-config.ts is a byte copy, checked by map-config.test.ts). Leaflet and its CSS are imported only
// here; callers load this file with next/dynamic and ssr: false. Read-only mode shows one pin per branch; edit mode (`onPick`) shows
// one draggable pin that a click on the map or a drag moves. The always-visible latitude and longitude fields are the keyboard
// alternative and drive `value` from outside.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { MAP_MAX_ZOOM, OSM_ATTRIBUTION, OSM_TILE_URL } from './map-config';

export interface MapPoint {
  key: string;
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  /** Pins in read-only mode, or the other branches as quiet context in edit mode. */
  points: MapPoint[];
  focusedKey?: string | null;
  onFocus?: (key: string) => void;
  /** Edit mode: the position of the draggable pin (null: none yet) and the callback for a click or a drag. */
  value?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  /** A geocoded place: the map recentres on it. */
  center?: { lat: number; lng: number } | null;
  label: string;
  pinName?: string;
}

// Pins are divIcons (no marker image files, so the bundler has no default image path to break). Classes are admin-kit tokens.
const pin = (tone: 'focused' | 'idle' | 'edit') =>
  L.divIcon({
    className: '',
    html: `<span class="block size-300 rounded-full border-2 border-border-on shadow-card ${tone === 'idle' ? 'bg-text-subdued' : 'bg-bg-brand'}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
const ICONS = { focused: pin('focused'), idle: pin('idle'), edit: pin('edit') };

const DEFAULT_CENTER = { lat: 51.16, lng: 10.45 };

function Controller({ points, value, focused, center }: { points: { lat: number; lng: number }[]; value: { lat: number; lng: number } | null; focused: { lat: number; lng: number } | null; center: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    // Fit the pins once on mount; later changes pan or recentre.
    if (value) map.setView([value.lat, value.lng], 13);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [32, 32], maxZoom: 12 });
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit on mount only
  }, [map]);
  useEffect(() => {
    if (focused) map.panTo([focused.lat, focused.lng]);
  }, [map, focused]);
  useEffect(() => {
    if (value) map.panTo([value.lat, value.lng]);
  }, [map, value]);
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], Math.max(map.getZoom(), 13));
  }, [map, center]);
  return null;
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

export default function BranchMap({ points, focusedKey = null, onFocus, value = null, onPick, center = null, label, pinName }: Props) {
  const focused = useMemo(() => points.find((p) => p.key === focusedKey) ?? null, [points, focusedKey]);
  const start = value ?? points[0] ?? DEFAULT_CENTER;
  return (
    <div role="region" aria-label={label} className="h-full min-h-6400 w-full overflow-hidden rounded-300">
      <MapContainer center={[start.lat, start.lng]} zoom={value ? 13 : 6} maxZoom={MAP_MAX_ZOOM} scrollWheelZoom className="h-full min-h-6400 w-full">
        <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} maxZoom={MAP_MAX_ZOOM} />
        {points.map((p) => (
          <Marker
            key={p.key}
            position={[p.lat, p.lng]}
            icon={p.key === focusedKey ? ICONS.focused : ICONS.idle}
            zIndexOffset={p.key === focusedKey ? 1000 : 0}
            title={p.name}
            alt={p.name}
            eventHandlers={onFocus ? { click: () => onFocus(p.key) } : undefined}
          />
        ))}
        {onPick ? <ClickToPick onPick={onPick} /> : null}
        {onPick && value ? (
          <Marker
            position={[value.lat, value.lng]}
            icon={ICONS.edit}
            draggable
            zIndexOffset={2000}
            title={pinName}
            alt={pinName}
            eventHandlers={{
              dragend: (event) => {
                const at = (event.target as L.Marker).getLatLng();
                onPick(at.lat, at.lng);
              },
            }}
          />
        ) : null}
        <Controller points={points} value={value} focused={focused} center={center} />
      </MapContainer>
    </div>
  );
}
