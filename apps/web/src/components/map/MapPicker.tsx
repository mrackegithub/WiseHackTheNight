import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { config } from '../../lib/config';

export interface LatLng {
  lat: number;
  lng: number;
}

const BUDAPEST: LatLng = { lat: 47.4979, lng: 19.0402 };

function ClickToPick({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Keeps the selected point in view when it changes from outside (e.g. an address search). */
function FollowValue({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView(value, Math.max(map.getZoom(), 15));
  }, [map, value]);
  return null;
}

interface MapPickerProps {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
}

/** Click the map to drop a pin. Default export so it can be lazy-loaded (Leaflet is ~150 kB). */
export default function MapPicker({ value, onChange }: MapPickerProps) {
  return (
    <MapContainer
      center={value ?? BUDAPEST}
      zoom={value ? 15 : 12}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-lg border border-slate-200"
      aria-label="Map: click to set your home base"
    >
      <TileLayer url={config.mapTileUrl} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      {value && <CircleMarker center={value} radius={9} pathOptions={{ color: '#4f46e5', fillOpacity: 0.5 }} />}
      <ClickToPick onPick={onChange} />
      <FollowValue value={value} />
    </MapContainer>
  );
}
