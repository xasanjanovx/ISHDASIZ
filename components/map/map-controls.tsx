'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useMap, useMapEvents } from 'react-leaflet';
import { Locate, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';

export function MapViewport({ center, zoom }: { center: { lat: number; lng: number }; zoom: number }) {
    const map = useMap();
    useEffect(() => { map.setView([center.lat, center.lng], zoom); }, [map, center.lat, center.lng, zoom]);
    return null;
}

export function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
    useMapEvents({ click: event => onMapClick?.(event.latlng.lat, event.latlng.lng) });
    return null;
}

export function LocateControl() {
    const map = useMap();
    const { lang } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const position = useRef<L.LayerGroup | null>(null);

    useEffect(() => {
        const found = (event: L.LocationEvent) => {
            setLoading(false);
            setError(false);
            position.current?.remove();
            position.current = L.layerGroup([
                L.circle(event.latlng, { radius: event.accuracy / 2 }),
                L.circleMarker(event.latlng, { radius: 7, color: '#2563eb', fillOpacity: 1 }),
            ]).addTo(map);
        };
        const failed = () => { setLoading(false); setError(true); };
        map.on('locationfound', found);
        map.on('locationerror', failed);
        return () => {
            map.off('locationfound', found);
            map.off('locationerror', failed);
            map.stopLocate();
            position.current?.remove();
        };
    }, [map]);

    const label = lang === 'uz' ? 'Mening joylashuvim' : 'Моё местоположение';
    return <div className="leaflet-top leaflet-right">
        <div className="leaflet-control leaflet-bar" ref={element => { if (element) L.DomEvent.disableClickPropagation(element); }}>
            <button type="button" aria-label={label} title={label} disabled={loading}
                className="flex h-[34px] w-[34px] items-center justify-center bg-white p-2 text-slate-600 hover:bg-slate-50"
                onClick={event => {
                    event.stopPropagation();
                    setLoading(true);
                    setError(false);
                    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true, timeout: 10000 });
                }}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Locate className="h-5 w-5" />}
            </button>
        </div>
        {error && <p role="alert" className="leaflet-control max-w-48 rounded-lg bg-white p-2 text-xs text-red-700 shadow">
            {lang === 'ru' ? 'Не удалось определить местоположение. Разрешите доступ или выберите место на карте.' : 'Joylashuv aniqlanmadi. Ruxsat bering yoki xaritadan joy tanlang.'}
        </p>}
    </div>;
}
