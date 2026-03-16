import React from 'react';
import { Crosshair, MapPin, Navigation, X } from 'lucide-react';
import { DivIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';

const markerIcon = new DivIcon({
  className: '',
  html: '<div style="position:relative;width:30px;height:30px;"><div style="position:absolute;inset:0;border-radius:999px;background:linear-gradient(135deg,#21404d 0%,#e76f51 100%);box-shadow:0 14px 32px rgba(33,64,77,0.28);"></div><div style="position:absolute;left:8px;top:8px;width:14px;height:14px;border-radius:999px;background:white;"></div></div>',
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
        liveMap: 'Живая карта',
        dragHint: 'Нажмите на карту или перетащите пин.',
        readyTitle: 'Готово к подтверждению',
        readyDescription: 'Выбранная точка сохранится как адрес заказа.',
      };
    }

    if (language === 'en') {
      return {
        liveMap: 'Live map',
        dragHint: 'Tap the map or drag the pin.',
        readyTitle: 'Ready to confirm',
        readyDescription: 'The selected point will be saved as the order address.',
      };
    }

    return {
      liveMap: 'Jonli xarita',
      dragHint: 'Nuqtani xaritada bosing yoki pinni suring.',
      readyTitle: 'Tasdiqlashga tayyor',
      readyDescription: 'Tanlangan nuqta buyurtma manzili sifatida saqlanadi.',
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
      <div className="rounded-lg border border-[#dbe5e0] bg-[linear-gradient(135deg,rgba(239,246,243,0.96)_0%,rgba(252,248,243,0.94)_100%)] p-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between sm:gap-3 gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#40635b]">{copy.liveMap}</p>
            <p className="mt-1.5 text-xs leading-5 text-[#5b6770]">{t('cart.map_description')}</p>
            <p className="mt-2 text-xs font-medium text-[#1f2933]">
              {selectedAddress || address || t('cart.map_selected_empty')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenState(!open)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#21404d] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 shrink-0"
          >
            <MapPin size={14} />
            {open ? t('cart.map_close') : t('cart.map_open')}
          </button>
        </div>
      </div>

      {open ? (
        <div className="rounded-lg border border-white/70 bg-[rgba(255,252,247,0.96)] p-3 shadow-sm">
          <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-[#1f2933]">{t('cart.map_picker')}</p>
              <p className="mt-1 text-[11px] text-[#7b8790]">{copy.dragHint}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#d9cdbd] bg-[rgba(255,248,240,0.94)] px-2.5 py-1.5 text-xs font-semibold text-[#31424d] transition hover:bg-white"
              >
                <Crosshair size={12} />
                {t('cart.map_use_current')}
              </button>
              <button
                type="button"
                onClick={() => setOpenState(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9cdbd] bg-[rgba(255,248,240,0.94)] text-[#31424d] transition hover:bg-white"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-[#d9e4df] shadow-sm">
            <div className="pointer-events-none absolute left-2.5 top-2.5 z-[500] rounded-full bg-[rgba(255,255,255,0.92)] px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#40635b] shadow-sm">
              {t('cart.map_select_hint')}
            </div>
            <MapContainer center={selectedPosition} zoom={15} scrollWheelZoom className="h-64 w-full">
              <TileLayer
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
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

          <div className="mt-3 grid gap-2.5 md:grid-cols-[1.4fr,1fr]">
            <div className="rounded-lg bg-[linear-gradient(135deg,rgba(33,64,77,0.96)_0%,rgba(61,108,119,0.94)_100%)] p-3 text-white">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/12 text-white shrink-0">
                  <Navigation size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">{t('cart.map_selected_title')}</p>
                  <p className="mt-1.5 text-xs font-semibold leading-5 text-white">
                    {resolvingAddress ? t('cart.map_loading_address') : (selectedAddress || address || t('cart.map_selected_empty'))}
                  </p>
                  <p className="mt-1.5 text-[10px] text-white/70">
                    {t('cart.map_selected_coords', {
                      lat: formatCoordinate(selectedPosition[0]),
                      lng: formatCoordinate(selectedPosition[1]),
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-[rgba(255,248,240,0.94)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9a6b3a]">{copy.readyTitle}</p>
              <p className="mt-1.5 text-xs leading-5 text-[#5b6770]">{copy.readyDescription}</p>
              {mapError ? <p className="mt-2 text-[10px] text-rose-600">{mapError}</p> : null}
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#f59e0b_0%,#e76f51_100%)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105"
            >
              <MapPin size={14} />
              {t('cart.map_confirm')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
