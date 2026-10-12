'use client';
import { useEffect, useId, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Region, District } from '@/types/database';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/language-context';
interface LocationSelectProps {
    selectedRegion: string | number | null;
    selectedDistrict: string | number | null;
    onRegionChange: (regionId: string) => void;
    onDistrictChange: (districtId: string) => void;
    required?: boolean;
    className?: string;
    showLabels?: boolean;
    disabled?: boolean;
    regions?: Region[];
    showAllOption?: boolean;
}
export function LocationSelect({ selectedRegion, selectedDistrict, onRegionChange, onDistrictChange, required = false, className,
    showLabels = true, disabled = false, regions: initialRegions, showAllOption = false }: LocationSelectProps) {
    const { lang } = useLanguage();
    const id = useId();
    const provided = initialRegions?.length ? initialRegions : null;
    const [regionRevision, setRegionRevision] = useState(0), [districtRevision, setDistrictRevision] = useState(0);
    const [regionResult, setRegionResult] = useState<{ revision: number; data: Region[]; error: boolean } | null>(null);
    const [districtResult, setDistrictResult] = useState<{ key: string; data: District[]; error: boolean } | null>(null);
    const regionKey = String(selectedRegion || '');
    const validRegion = /^\d+$/.test(regionKey) && Number(regionKey) > 0;
    const districtKey = `${regionKey}:${districtRevision}`;
    useEffect(() => {
        if (provided) return;
        let cancelled = false; const controller = new AbortController();
        supabase.from('regions').select('id,name_uz,name_ru').order('name_uz').abortSignal(controller.signal)
            .then(({ data, error }) => {
                if (!cancelled) setRegionResult({ revision: regionRevision, data: error ? [] : data as Region[] || [], error: Boolean(error) });
            }, () => { if (!cancelled) setRegionResult({ revision: regionRevision, data: [], error: true }); });
        return () => { cancelled = true; controller.abort(); };
    }, [provided, regionRevision]);
    useEffect(() => {
        if (!validRegion) return;
        let cancelled = false; const controller = new AbortController();
        supabase.from('districts').select('id,region_id,name_uz,name_ru').eq('region_id', Number(regionKey)).order('name_uz').abortSignal(controller.signal)
            .then(({ data, error }) => {
                if (!cancelled) setDistrictResult({ key: districtKey, data: error ? [] : data as District[] || [], error: Boolean(error) });
            }, () => { if (!cancelled) setDistrictResult({ key: districtKey, data: [], error: true }); });
        return () => { cancelled = true; controller.abort(); };
    }, [regionKey, districtKey, validRegion]);
    const regions = provided || (regionResult?.revision === regionRevision ? regionResult.data : []);
    const regionsLoading = !provided && regionResult?.revision !== regionRevision;
    const districtsLoading = validRegion && districtResult?.key !== districtKey;
    const districts = validRegion && districtResult?.key === districtKey ? districtResult.data : [];
    const regionError = !provided && regionResult?.revision === regionRevision && regionResult.error;
    const districtError = validRegion && districtResult?.key === districtKey && districtResult.error;
    const regionLabel = lang === 'ru' ? 'Регион / Область' : 'Viloyat';
    const districtLabel = lang === 'ru' ? 'Район / Город' : 'Tuman / Shahar';
    const all = lang === 'ru' ? 'Все' : 'Barchasi';
    return <div className={cn('grid gap-4', className)}>
        <div className="space-y-2">
            {showLabels && <Label htmlFor={`${id}-region`}>{regionLabel} {required && '*'}</Label>}
            <Select value={regionKey || (showAllOption ? 'all' : '')} disabled={disabled || regionsLoading} onValueChange={value => {
                onRegionChange(value); if (value === 'all') onDistrictChange('all');
            }}>
                <SelectTrigger id={`${id}-region`} aria-label={regionLabel} className="h-12 bg-white rounded-xl">
                    <SelectValue placeholder={showAllOption ? all : lang === 'ru' ? 'Выберите регион' : 'Viloyatni tanlang'} />
                </SelectTrigger>
                <SelectContent>{showAllOption && <SelectItem value="all">{all}</SelectItem>}{regions.map(region => <SelectItem key={region.id} value={String(region.id)}>{lang === 'ru' ? region.name_ru : region.name_uz}</SelectItem>)}</SelectContent>
            </Select>
            {regionError && <div role="alert" className="space-y-2 text-sm text-red-700"><p>{lang === 'ru' ? 'Не удалось загрузить регионы.' : 'Viloyatlarni yuklab bo‘lmadi.'}</p><Button type="button" variant="outline" onClick={() => setRegionRevision(value => value + 1)}>{lang === 'ru' ? 'Повторить регионы' : 'Viloyatlarni qayta yuklash'}</Button></div>}
        </div>
        <div className="space-y-2">
            {showLabels && <Label htmlFor={`${id}-district`}>{districtLabel} {required && '*'}</Label>}
            <Select value={selectedDistrict?.toString() || (showAllOption ? 'all' : '')} onValueChange={onDistrictChange} disabled={disabled || !validRegion || districtsLoading || Boolean(districtError)}>
                <SelectTrigger id={`${id}-district`} aria-label={districtLabel} className="h-12 bg-white rounded-xl"><SelectValue placeholder={!validRegion ? (showAllOption ? all : '—') : lang === 'ru' ? 'Выберите район' : 'Tumanni tanlang'} /></SelectTrigger>
                <SelectContent>{showAllOption && <SelectItem value="all">{all}</SelectItem>}{districts.map(district => <SelectItem key={district.id} value={String(district.id)}>{lang === 'ru' ? district.name_ru : district.name_uz}</SelectItem>)}</SelectContent>
            </Select>
            {districtError && <div role="alert" className="space-y-2 text-sm text-red-700"><p>{lang === 'ru' ? 'Не удалось загрузить районы.' : 'Tumanlarni yuklab bo‘lmadi.'}</p><Button type="button" variant="outline" onClick={() => setDistrictRevision(value => value + 1)}>{lang === 'ru' ? 'Повторить районы' : 'Tumanlarni qayta yuklash'}</Button></div>}
        </div>
    </div>;
}
