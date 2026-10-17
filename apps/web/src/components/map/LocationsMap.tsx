import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { config } from '../../lib/config';

export interface MapPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

function FitToPlaces({ places }: { places: MapPlace[] }) {
  const map = useMap();
  useEffect(() => {
    // animate: false: a running zoom animation crashes Leaflet ("_leaflet_pos") if the page unmounts the map
    if (places.length === 1) map.setView([places[0].lat, places[0].lng], 15, { animate: false });
    else if (places.length > 1) map.fitBounds(places.map((p) => [p.lat, p.lng] as [number, number]), { padding: [32, 32], animate: false });
  }, [map, places]);
  return null;
}

interface LocationsMapProps {
  places: MapPlace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Numbered markers for suggested places. Default export so it can be lazy-loaded with Leaflet. */
export default function LocationsMap({ places, selectedId, onSelect }: LocationsMapProps) {
  const center = places[0] ?? { lat: 47.4979, lng: 19.0402 };
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={14} scrollWheelZoom={false} className="relative isolate z-0 h-64 w-full rounded-lg border border-slate-200">
      <TileLayer url={config.mapTileUrl} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      {places.map((p, i) => {
        const selected = p.id === selectedId;
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={selected ? 12 : 9}
            pathOptions={{ color: selected ? '#4338ca' : '#6366f1', fillOpacity: selected ? 0.8 : 0.45, weight: selected ? 3 : 2 }}
            eventHandlers={{ click: () => onSelect(p.id) }}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent={selected}>
              {i + 1}. {p.name}
            </Tooltip>
          </CircleMarker>
        );
      })}
      <FitToPlaces places={places} />
    </MapContainer>
  );
}
