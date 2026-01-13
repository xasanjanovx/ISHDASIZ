'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { JobWithRelations } from '@/types/database';
import { UZBEKISTAN_CENTER, MAP_COUNTRY_ZOOM, formatSalary } from '@/lib/constants';
import { MapPin, Building2, Banknote } from '@/components/ui/icons';
import { Locate, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface JobMapProps {
  jobs: JobWithRelations[];
  selectedJobId?: string;
  onJobSelect?: (job: JobWithRelations) => void;
  interactive?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  markerPosition?: { lat: number; lng: number } | null;
  height?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
}

export function JobMap({
  jobs,
  selectedJobId,
  onJobSelect,
  interactive = false,
  onMapClick,
  markerPosition,
  height = '500px',
  center,
  zoom,
}: JobMapProps) {
  const { lang, t } = useLanguage();
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Popup, setPopup] = useState<any>(null);
  const [useMapEvents, setUseMapEvents] = useState<any>(null);
  const [L, setL] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const leaflet = await import('leaflet');
      const reactLeaflet = await import('react-leaflet');

      setL(leaflet.default);
      setMapContainer(() => reactLeaflet.MapContainer);
      setTileLayer(() => reactLeaflet.TileLayer);
      setMarker(() => reactLeaflet.Marker);
      setPopup(() => reactLeaflet.Popup);
      setUseMapEvents(() => reactLeaflet.useMapEvents);
      setUseMap(() => reactLeaflet.useMap);
      setIsLoaded(true);
    })();
  }, []);

  const [useMap, setUseMap] = useState<any>(null);

  // Component to handle user location
  function LocateControl() {
    const map = useMap();
    const [loading, setLoading] = useState(false);

    const handleLocate = (e: any) => {
      e.stopPropagation();
      setLoading(true);
      map.locate({
        setView: true,
        maxZoom: 16,
        enableHighAccuracy: true,
        timeout: 10000
      });
    };

    useEffect(() => {
      const onLocationFound = (e: any) => {
        setLoading(false);
        // Optional: Add a marker or circle at user location
        L.circle(e.latlng, { radius: e.accuracy / 2 }).addTo(map);
        L.marker(e.latlng).addTo(map).bindPopup(lang === 'uz' ? 'Sizning joylashuvingiz' : 'Ваше местоположение').openPopup();
      };

      const onLocationError = (e: any) => {
        setLoading(false);
        console.error('Location init error', e);
        // Don't alert on auto-init error to avoid annoyance
        if (e.type !== 'locationerror') {
          alert(lang === 'uz' ? 'Joylashuvni aniqlab bo\'lmadi' : 'Не удалось определить местоположение');
        }
      };

      map.on('locationfound', onLocationFound);
      map.on('locationerror', onLocationError);

      return () => {
        map.off('locationfound', onLocationFound);
        map.off('locationerror', onLocationError);
      };
    }, [map]);

    return (
      <div className="leaflet-top leaflet-right">
        <div className="leaflet-control leaflet-bar">
          <button
            onClick={handleLocate}
            className="bg-white p-2 hover:bg-slate-50 flex items-center justify-center w-[34px] h-[34px] shadow-sm border-b-2 border-slate-200"
            title={lang === 'uz' ? "Mening joylashuvim" : "Моё местоположение"}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-sky-600" /> : <Locate className="w-5 h-5 text-slate-600" />}
          </button>
        </div>
      </div>
    );
  }

  if (!isLoaded || !MapContainer) {
    return (
      <div
        className="bg-slate-100 rounded-lg flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-slate-500 flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          {lang === 'uz' ? 'Xarita yuklanmoqda...' : 'Загрузка карты...'}
        </div>
      </div>
    );
  }

  // Calculate dynamic center from jobs with location
  const jobsWithLocation = jobs.filter((j) => j.latitude && j.longitude);

  let mapCenter = center || UZBEKISTAN_CENTER;
  let mapZoom = zoom || MAP_COUNTRY_ZOOM;

  if (!center && jobsWithLocation.length > 0) {
    // Calculate bounds center
    const lats = jobsWithLocation.map(j => j.latitude!);
    const lngs = jobsWithLocation.map(j => j.longitude!);
    mapCenter = {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
    // Adjust zoom based on spread
    const latSpread = Math.max(...lats) - Math.min(...lats);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);
    const spread = Math.max(latSpread, lngSpread);
    if (spread < 0.5) mapZoom = 12;
    else if (spread < 2) mapZoom = 10;
    else if (spread < 5) mapZoom = 8;
    else mapZoom = 6;
  } else if (markerPosition) {
    mapCenter = markerPosition;
    mapZoom = 14;
  }

  const defaultIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div class="custom-marker-inner"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  const selectedIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div class="custom-marker-inner" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });

  const pickerIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div class="custom-marker-inner" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });

  function MapClickHandler() {
    useMapEvents({
      click: (e: any) => {
        if (onMapClick) {
          onMapClick(e.latlng.lat, e.latlng.lng);
        }
      },
    });
    return null;
  }

  return (
    <div style={{ height }} className="rounded-lg overflow-hidden shadow-lg">
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {interactive && <MapClickHandler />}
        {useMap && <LocateControl />}

        {markerPosition && (
          <Marker position={[markerPosition.lat, markerPosition.lng]} icon={pickerIcon}>
            <Popup>
              <div className="p-2 text-center">
                <p className="font-medium text-sm">
                  {lang === 'uz' ? 'Tanlangan joy' : 'Выбранное место'}
                </p>
                <p className="text-xs text-slate-500">
                  {markerPosition.lat.toFixed(4)}, {markerPosition.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {jobsWithLocation.map((job) => {
          const title = lang === 'uz' ? job.title_uz : job.title_ru;
          const isSelected = job.id === selectedJobId;

          return (
            <Marker
              key={job.id}
              position={[job.latitude!, job.longitude!]}
              icon={isSelected ? selectedIcon : defaultIcon}
              eventHandlers={{
                click: () => onJobSelect?.(job),
              }}
            >
              <Popup>
                <div className="p-3 min-w-[200px]">
                  <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
                  <p className="text-sm text-slate-600 flex items-center gap-1 mb-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {job.company_name}
                  </p>
                  <p className="text-sm text-emerald-600 flex items-center gap-1 mb-2">
                    <Banknote className="w-3.5 h-3.5" />
                    {formatSalary(job.salary_min, job.salary_max, lang)}
                  </p>
                  {job.address && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                      <MapPin className="w-3 h-3" />
                      {job.address}
                    </p>
                  )}
                  <Link href={`/jobs/${job.id}`}>
                    <Button size="sm" className="w-full">
                      {t.job.details}
                    </Button>
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
