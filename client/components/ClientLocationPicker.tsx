import React from 'react';
import { Crosshair, MapPin, X } from 'lucide-react';
import { DivIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';

const markerIcon = new DivIcon({
  className: '',
  html: `<div style="position:relative;width:32px;height:32px;">
    <div style="position:absolute;inset:0;border-radius:999px;background:#2563eb;box-shadow:0 4px 14px rgba(37,99,235,0.45);"></div>
    <div style="position:absolute;left:9px;top:9px;width:14px;height:14px;border-radius:999px;background:white;"></div>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const MapEvents: React.FC<{ onSelect: (lat: number, lng: number) => void }> = ({ onSelect }) => {
  useMapEvents({
    click(e) { onSelect(e.latlng.lat, e.latlng.lng); },
  });
  return null;
};

const MapViewport: React.FC<{ position: [number, number] }> = ({ position }) => {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(position, Math.max(map.getZoom(), 15), { animate: true, duration: 0.45 });
    const t = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(t);
  }, [map, position]);
  return null;
};

interface ClientLocationPickerProps {
  address: string;
  latitude: string;
  longitude: string;
  onApply: (payload: { location_text: string; location_lat: string; location_lng: string }) => void;
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
}

const fmt = (v: number) => v.toFixed(6);

export const ClientLocationPicker: React.FC<ClientLocationPickerProps> = ({
  address,
  latitude,
  longitude,
  onApply,
  expanded,
  onExpandedChange,
}) => {
  const { t } = useClientLanguage();
  const [internalOpen, setInternalOpen] = React.useState(true);
  const open = expanded ?? internalOpen;

  const setOpenState = React.useCallback((next: boolean) => {
    if (expanded === undefined) setInternalOpen(next);
    onExpandedChange?.(next);
  }, [expanded, onExpandedChange]);

  const initialLat = Number(latitude);
  const initialLng = Number(longitude);
  const initialPosition = React.useMemo<[number, number]>(
    () => (Number.isFinite(initialLat) && Number.isFinite(initialLng) ? [initialLat, initialLng] : [41.3111, 69.2797]),
    [initialLat, initialLng]
  );
  const [selectedPosition, setSelectedPosition] = React.useState<[number, number]>(initialPosition);
  const [selectedAddress, setSelectedAddress] = React.useState(address);
  const [resolving, setResolving] = React.useState(false);
  const [mapError, setMapError] = React.useState<string | null>(null);

  React.useEffect(() => { setSelectedPosition(initialPosition); }, [initialPosition]);
  React.useEffect(() => { setSelectedAddress(address); }, [address]);

  const resolveAddress = React.useCallback(async (lat: number, lng: number) => {
    try {
      setResolving(true);
      setMapError(null);
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      const label = typeof data?.display_name === 'string' && data.display_name.trim()
        ? data.display_name
        : `${fmt(lat)}, ${fmt(lng)}`;
      setSelectedAddress(label);
      return label;
    } catch {
      setMapError(t('cart.map_reverse_error'));
      const fallback = `${fmt(lat)}, ${fmt(lng)}`;
      setSelectedAddress(fallback);
      return fallback;
    } finally {
      setResolving(false);
    }
  }, [t]);

  const handleSelect = React.useCallback((lat: number, lng: number) => {
    setSelectedPosition([lat, lng]);
    void resolveAddress(lat, lng);
  }, [resolveAddress]);

  const handleUseCurrentLocation = React.useCallback(() => {
    if (!navigator.geolocation) { setMapError(t('cart.map_geolocation_error')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSelectedPosition([pos.coords.latitude, pos.coords.longitude]);
        void resolveAddress(pos.coords.latitude, pos.coords.longitude);
      },
      () => setMapError(t('cart.map_geolocation_error')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [resolveAddress, t]);

  const handleApply = React.useCallback(() => {
    onApply({
      location_text: selectedAddress || `${fmt(selectedPosition[0])}, ${fmt(selectedPosition[1])}`,
      location_lat: fmt(selectedPosition[0]),
      location_lng: fmt(selectedPosition[1]),
    });
    setOpenState(false);
  }, [onApply, selectedAddress, selectedPosition, setOpenState]);

  const hasPosition = selectedAddress && selectedAddress !== address;

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin size={15} className="shrink-0 text-blue-600" />
          <p className="truncate text-sm text-slate-700">{selectedAddress || address || t('cart.map_selected_empty')}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpenState(true)}
          className="shrink-0 text-xs font-medium text-blue-600 transition hover:text-blue-700"
        >
          {t('cart.map_open')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Map container */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        {/* Map header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-3 py-2.5">
          <div className="flex items-center gap-2">
            <MapPin size={15} className="text-blue-600" />
            <span className="text-sm font-semibold text-slate-950">{t('cart.map_picker')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
            >
              <Crosshair size={12} />
              {t('cart.map_use_current')}
            </button>
            <button
              type="button"
              onClick={() => setOpenState(false)}
              className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Map */}
        <div className="relative">
          <MapContainer center={selectedPosition} zoom={15} scrollWheelZoom className="h-[300px] w-full">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <MapViewport position={selectedPosition} />
            <Marker
              position={selectedPosition}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const ll = e.target.getLatLng();
                  handleSelect(ll.lat, ll.lng);
                },
              }}
            />
            <MapEvents onSelect={handleSelect} />
          </MapContainer>
          {/* Tap hint */}
          <div className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm">
            {t('cart.map_select_hint')}
          </div>
        </div>

        {/* Selected address */}
        <div className="border-t border-slate-100 bg-white px-3 py-3">
          {resolving ? (
            <p className="text-sm text-slate-400">{t('cart.map_loading_address')}</p>
          ) : (
            <p className="text-sm text-slate-700 leading-snug">{selectedAddress || address || t('cart.map_selected_empty')}</p>
          )}
          {mapError ? <p className="mt-1 text-xs text-rose-600">{mapError}</p> : null}
          <p className="mt-1 text-xs text-slate-400">
            {fmt(selectedPosition[0])}, {fmt(selectedPosition[1])}
          </p>
        </div>
      </div>

      {/* Confirm button */}
      <button
        type="button"
        onClick={handleApply}
        disabled={resolving}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,0.30)] transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60"
      >
        <MapPin size={15} />
        {hasPosition ? t('cart.map_confirm') : (t('cart.map_confirm') || 'Confirm location')}
      </button>
    </div>
  );
};
