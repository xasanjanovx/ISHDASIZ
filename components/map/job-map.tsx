'use client';

import dynamic from 'next/dynamic';
import type { JobWithRelations } from '@/types/database';
import { useLanguage } from '@/contexts/language-context';

export interface JobMapProps {
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


function MapLoading() {
  const { lang } = useLanguage();
  return <div role="status" className="flex h-full items-center justify-center gap-2 text-muted-foreground">
      <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {lang === 'uz' ? 'Xarita yuklanmoqda…' : 'Загрузка карты…'}
  </div>;
}

const ClientMap = dynamic(() => import('./job-map-client'), { ssr: false, loading: MapLoading });

export function JobMap(props: JobMapProps) {
  return <div style={{ height: props.height || '500px' }} className="rounded-lg bg-secondary">
    <ClientMap {...props} />
  </div>;
}
