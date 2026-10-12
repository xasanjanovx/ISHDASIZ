'use client';

import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateControl, MapClickHandler, MapViewport } from './map-controls';
import { useLanguage } from '@/contexts/language-context';
import { JobWithRelations } from '@/types/database';
import { UZBEKISTAN_CENTER, MAP_COUNTRY_ZOOM, formatSalary } from '@/lib/constants';
import { MapPin, Building2, Banknote } from '@/components/ui/icons';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

import type { JobMapProps } from './job-map';
import { hasValidCoordinates } from '@/lib/coordinates';

export default function JobMapClient({
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
  // Calculate dynamic center from jobs with location
  const jobsWithLocation = jobs.filter(hasValidCoordinates);

  const validCenter = center && hasValidCoordinates({ latitude: center.lat, longitude: center.lng }) ? center : undefined;
  const validMarker = markerPosition && hasValidCoordinates({ latitude: markerPosition.lat, longitude: markerPosition.lng }) ? markerPosition : null;
  let mapCenter = validCenter || UZBEKISTAN_CENTER;
  let mapZoom = typeof zoom === 'number' && Number.isFinite(zoom) ? Math.min(18, Math.max(0, zoom)) : MAP_COUNTRY_ZOOM;

  if (!validCenter && jobsWithLocation.length > 0) {
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
  } else if (validMarker) {
    mapCenter = validMarker;
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


  return (
    <div style={{ height }} className="rounded-lg overflow-hidden shadow-lg">
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

        {interactive && <MapClickHandler onMapClick={onMapClick} />}
        <LocateControl />
        <MapViewport center={mapCenter} zoom={mapZoom} />

        {validMarker && (
          <Marker position={[validMarker.lat, validMarker.lng]} icon={pickerIcon}>
            <Popup>
              <div className="p-2 text-center">
                <p className="font-medium text-sm">
                  {lang === 'uz' ? 'Tanlangan joy' : 'Выбранное место'}
                </p>
                <p className="text-xs text-slate-500">
                  {validMarker.lat.toFixed(4)}, {validMarker.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {jobsWithLocation.map((job) => {
          const title = (lang === 'uz' ? job.title_uz : job.title_ru) || job.title_uz || job.title_ru || (lang === 'uz' ? 'Vakansiya' : 'Вакансия');
          const isSelected = job.id === selectedJobId;

          return (
            <Marker
              key={job.id}
              position={[job.latitude!, job.longitude!]}
              icon={isSelected ? selectedIcon : defaultIcon}
              title={title}
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
