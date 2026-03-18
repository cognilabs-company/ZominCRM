import React from 'react';
import { Crosshair, MapPin, Navigation, X } from 'lucide-react';
import { DivIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';

const markerIcon = new DivIcon({
  className: '',
  html: '<div style="position:relative;width:30px;height:30px;"><div style="position:absolute;inset:0;border-radius:999px;background:#0f172a;box-shadow:0 14px 32px rgba(15,23,42,0.24);"></div><div style="position:absolute;left:8px;top:8px;width:14px;height:14px;border-radius:999px;background:white;"></div></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const MapEvents: React.FC<{ onSelect: (lat: number, lng: number) => void }> = ({ onSelect }) => {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
};

const MapViewport: React.FC<{ position: [number, number] }> = ({ position }) => {
  const map = useMap();

  React.useEffect(() => {
    map.flyTo(position, Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.45,
    });

    const timeout = window.setTimeout(() => {
      map.invalidateSize();
    }, 50);

    return () => window.clearTimeout(timeout);
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

const formatCoordinate = (value: number) => value.toFixed(6);

export const ClientLocationPicker: React.FC<ClientLocationPickerProps> = ({
  address,
  latitude,
  longitude,
  onApply,
  expanded,
  onExpandedChange,
}) => {
  const { language, t } = useClientLanguage();
  const copy = React.useMemo(() => {
    if (language === 'ru') {
      return {
        liveMap: 'Карта',
        dragHint: 'Нажмите на карту или перетащите пин.',
        readyTitle: 'Точка выбрана',
        readyDescription: 'Сохраните адрес для заказа.',
      };
    }

    if (language === 'en') {
      return {
        liveMap: 'Map',
        dragHint: 'Tap the map or drag the pin.',
        readyTitle: 'Point selected',
        readyDescription: 'Save this address for the order.',
      };
    }

    return {
      liveMap: 'Xarita',
      dragHint: 'Xaritani bosing yoki pinni suring.',
      readyTitle: 'Nuqta tanlandi',
      readyDescription: 'Buyurtma uchun manzilni saqlang.',
    };
  }, [language]);
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = expanded ?? internalOpen;
  const initialLat = Number(latitude);
  const initialLng = Number(longitude);
  const initialPosition = React.useMemo<[number, number]>(
    () => (Number.isFinite(initialLat) && Number.isFinite(initialLng) ? [initialLat, initialLng] : [41.3111, 69.2797]),
    [initialLat, initialLng]
  );
  const [selectedPosition, setSelectedPosition] = React.useState<[number, number]>(initialPosition);
  const [selectedAddress, setSelectedAddress] = React.useState(address);
  const [resolvingAddress, setResolvingAddress] = React.useState(false);
  const [mapError, setMapError] = React.useState<string | null>(null);

  const setOpenState = React.useCallback((next: boolean) => {
    if (expanded === undefined) {
      setInternalOpen(next);
    }
    onExpandedChange?.(next);
  }, [expanded, onExpandedChange]);

  React.useEffect(() => {
    setSelectedPosition(initialPosition);
  }, [initialPosition]);

  React.useEffect(() => {
    setSelectedAddress(address);
  }, [address]);

  const resolveAddress = React.useCallback(async (lat: number, lng: number) => {
    try {
      setResolvingAddress(true);
      setMapError(null);
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      const label = typeof data?.display_name === 'string' && data.display_name.trim()
        ? data.display_name
        : `${formatCoordinate(lat)}, ${formatCoordinate(lng)}`;
      setSelectedAddress(label);
      return label;
    } catch {
      setMapError(t('cart.map_reverse_error'));
      const fallback = `${formatCoordinate(lat)}, ${formatCoordinate(lng)}`;
      setSelectedAddress(fallback);
      return fallback;
    } finally {
      setResolvingAddress(false);
    }
  }, [t]);

  const handleSelect = React.useCallback((lat: number, lng: number) => {
    setSelectedPosition([lat, lng]);
    void resolveAddress(lat, lng);
  }, [resolveAddress]);

  const handleUseCurrentLocation = React.useCallback(() => {
    if (!navigator.geolocation) {
      setMapError(t('cart.map_geolocation_error'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = position.coords.latitude;
        const nextLng = position.coords.longitude;
        setSelectedPosition([nextLat, nextLng]);
        void resolveAddress(nextLat, nextLng);
      },
      () => {
        setMapError(t('cart.map_geolocation_error'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [resolveAddress, t]);

  const handleApply = React.useCallback(() => {
    onApply({
      location_text: selectedAddress || `${formatCoordinate(selectedPosition[0])}, ${formatCoordinate(selectedPosition[1])}`,
      location_lat: formatCoordinate(selectedPosition[0]),
      location_lng: formatCoordinate(selectedPosition[1]),
    });
    setOpenState(false);
  }, [onApply, selectedAddress, selectedPosition, setOpenState]);

  return (
    <div className="space-y-3">
      <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.liveMap}</p>
            <p className="mt-2 text-sm text-slate-500">{t('cart.map_description')}</p>
            <p className="mt-3 text-sm font-medium text-slate-950">
              {selectedAddress || address || t('cart.map_selected_empty')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenState(!open)}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
          >
            <MapPin size={16} />
            {open ? t('cart.map_close') : t('cart.map_open')}
          </button>
        </div>
      </div>

      {open ? (
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">{t('cart.map_picker')}</p>
              <p className="mt-1 text-xs text-slate-500">{copy.dragHint}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
              >
                <Crosshair size={14} />
                {t('cart.map_use_current')}
              </button>
              <button
                type="button"
                onClick={() => setOpenState(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[24px] border border-slate-200 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
            <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-full bg-white/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
              {t('cart.map_select_hint')}
            </div>
            <MapContainer center={selectedPosition} zoom={15} scrollWheelZoom className="h-[360px] w-full">
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
                  dragend: (event) => {
                    const marker = event.target;
                    const next = marker.getLatLng();
                    handleSelect(next.lat, next.lng);
                  },
                }}
              />
              <MapEvents onSelect={handleSelect} />
            </MapContainer>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr,1fr]">
            <div className="rounded-[18px] bg-slate-950 p-4 text-white">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/12 text-white">
                  <Navigation size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{t('cart.map_selected_title')}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white">
                    {resolvingAddress ? t('cart.map_loading_address') : (selectedAddress || address || t('cart.map_selected_empty'))}
                  </p>
                  <p className="mt-2 text-xs text-white/70">
                    {t('cart.map_selected_coords', {
                      lat: formatCoordinate(selectedPosition[0]),
                      lng: formatCoordinate(selectedPosition[1]),
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.readyTitle}</p>
              <p className="mt-2 text-sm text-slate-500">{copy.readyDescription}</p>
              {mapError ? <p className="mt-3 text-xs text-rose-600">{mapError}</p> : null}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              <MapPin size={16} />
              {t('cart.map_confirm')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
