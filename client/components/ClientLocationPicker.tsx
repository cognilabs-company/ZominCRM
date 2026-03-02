import React from 'react';
import { Crosshair, MapPin, Navigation, X } from 'lucide-react';
import { DivIcon, LatLngExpression } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';

const defaultCenter: LatLngExpression = [41.3111, 69.2797];

const markerIcon = new DivIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:999px;background:linear-gradient(135deg,#f59e0b 0%,#e76f51 100%);border:3px solid white;box-shadow:0 10px 22px rgba(231,111,81,0.35);"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
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
    map.setView(position);
  }, [map, position]);

  return null;
};

interface ClientLocationPickerProps {
  address: string;
  latitude: string;
  longitude: string;
  onApply: (payload: { location_text: string; location_lat: string; location_lng: string }) => void;
}

const formatCoordinate = (value: number) => value.toFixed(6);

export const ClientLocationPicker: React.FC<ClientLocationPickerProps> = ({
  address,
  latitude,
  longitude,
  onApply,
}) => {
  const { t } = useClientLanguage();
  const [open, setOpen] = React.useState(false);
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
    setOpen(false);
  }, [onApply, selectedAddress, selectedPosition]);

  return (
    <div className="space-y-3">
      <div className="rounded-[24px] border border-[#eadfce] bg-[rgba(255,248,240,0.84)] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a6b3a]">{t('cart.map_picker')}</p>
            <p className="mt-2 text-sm leading-6 text-[#5b6770]">{t('cart.map_description')}</p>
            {(latitude && longitude) ? (
              <p className="mt-3 text-xs text-[#7b8790]">
                {t('cart.map_selected_coords', { lat: latitude, lng: longitude })}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#21404d] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)] transition hover:brightness-105"
          >
            <MapPin size={16} />
            {open ? t('cart.map_close') : t('cart.map_open')}
          </button>
        </div>
      </div>

      {open ? (
        <div className="rounded-[28px] border border-white/70 bg-[rgba(255,252,247,0.92)] p-4 shadow-[0_24px_60px_rgba(58,44,28,0.10)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#1f2933]">{t('cart.map_picker')}</p>
              <p className="mt-1 text-xs text-[#7b8790]">{t('cart.map_select_hint')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#d9cdbd] bg-[rgba(255,248,240,0.94)] px-3 py-2 text-xs font-semibold text-[#31424d] transition hover:bg-white"
              >
                <Crosshair size={14} />
                {t('cart.map_use_current')}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d9cdbd] bg-[rgba(255,248,240,0.94)] text-[#31424d] transition hover:bg-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[#eadfce]">
            <MapContainer center={selectedPosition} zoom={13} scrollWheelZoom className="h-[320px] w-full">
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapViewport position={selectedPosition} />
              <Marker position={selectedPosition} icon={markerIcon} />
              <MapEvents onSelect={handleSelect} />
            </MapContainer>
          </div>

          <div className="mt-4 rounded-[24px] bg-[rgba(255,248,240,0.94)] p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#21404d] text-white">
                <Navigation size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1f2933]">{resolvingAddress ? t('cart.map_loading_address') : (selectedAddress || address || t('cart.delivery_address_placeholder'))}</p>
                <p className="mt-1 text-xs text-[#7b8790]">
                  {t('cart.map_selected_coords', {
                    lat: formatCoordinate(selectedPosition[0]),
                    lng: formatCoordinate(selectedPosition[1]),
                  })}
                </p>
                {mapError ? <p className="mt-2 text-xs text-rose-600">{mapError}</p> : null}
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#f59e0b_0%,#e76f51_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(231,111,81,0.24)] transition hover:brightness-105"
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
