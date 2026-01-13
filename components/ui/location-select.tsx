'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getRegions, getDistricts } from '@/lib/regions';
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
    regions?: Region[]; // Optional: pass regions if already fetched
    showAllOption?: boolean; // For filters
}

export function LocationSelect({
    selectedRegion,
    selectedDistrict,
    onRegionChange,
    onDistrictChange,
    required = false,
    className,
    showLabels = true,
    disabled = false,
    regions: initialRegions,
    showAllOption = false
}: LocationSelectProps) {
    const { lang } = useLanguage();
    const [regions, setRegions] = useState<Region[]>(initialRegions || []);
    const [districts, setDistricts] = useState<District[]>([]);
    const [loadingRegions, setLoadingRegions] = useState(false);
    const [loadingDistricts, setLoadingDistricts] = useState(false);

    useEffect(() => {
        if (initialRegions && initialRegions.length > 0) {
            setRegions(initialRegions);
        } else if (regions.length === 0) {
            const fetchRegions = async () => {
                setLoadingRegions(true);
                try {
                    const data = await getRegions();
                    setRegions(data);
                } catch (error) {
                    console.error('Failed to fetch regions', error);
                } finally {
                    setLoadingRegions(false);
                }
            };
            fetchRegions();
        }
    }, [initialRegions]); // Only run if initialRegions changes or mount

    useEffect(() => {
        const fetchDistricts = async () => {
            if (selectedRegion && selectedRegion !== 'all') {
                setLoadingDistricts(true);
                try {
                    const data = await getDistricts(Number(selectedRegion));
                    setDistricts(data);
                } catch (error) {
                    console.error('Failed to fetch districts', error);
                    setDistricts([]);
                } finally {
                    setLoadingDistricts(false);
                }
            } else {
                setDistricts([]);
            }
        };
        fetchDistricts();
    }, [selectedRegion]);

    const handleRegionChange = (value: string) => {
        onRegionChange(value);
        if (value === 'all') {
            onDistrictChange('all');
        }
    };

    const getRegionName = (r: Region) => lang === 'ru' ? r.name_ru : r.name_uz;
    const getDistrictName = (d: District) => lang === 'ru' ? d.name_ru : d.name_uz;

    const allLabel = lang === 'uz' ? 'Barchasi' : 'Все';
    const selectRegionLabel = lang === 'ru' ? 'Выберите регион' : 'Viloyatni tanlang';
    const selectDistrictLabel = lang === 'ru' ? 'Выберите район' : 'Tumanni tanlang';

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}>
            <div className="space-y-2">
                {showLabels && <Label className="font-medium">
                    {lang === 'ru' ? 'Регион / Область' : "Viloyat"} {required && '*'}
                </Label>}
                <Select
                    value={selectedRegion?.toString() || (showAllOption ? 'all' : '')}
                    onValueChange={handleRegionChange}
                    disabled={disabled || loadingRegions}
                >
                    <SelectTrigger className="h-12 bg-white">
                        <SelectValue placeholder={showAllOption ? allLabel : selectRegionLabel} />
                    </SelectTrigger>
                    <SelectContent>
                        {showAllOption && <SelectItem value="all">{allLabel}</SelectItem>}
                        {regions.map((r) => (
                            <SelectItem key={r.id} value={r.id.toString()}>
                                {getRegionName(r)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                {showLabels && <Label className="font-medium">
                    {lang === 'ru' ? 'Район / Город' : "Tuman / Shahar"} {required && '*'}
                </Label>}
                <Select
                    value={selectedDistrict?.toString() || (showAllOption ? 'all' : '')}
                    onValueChange={onDistrictChange}
                    disabled={disabled || !selectedRegion || selectedRegion === 'all' || loadingDistricts}
                >
                    <SelectTrigger className="h-12 bg-white">
                        <SelectValue placeholder={!selectedRegion || selectedRegion === 'all' ? (showAllOption ? allLabel : "---") : selectDistrictLabel} />
                    </SelectTrigger>
                    <SelectContent>
                        {showAllOption && <SelectItem value="all">{allLabel}</SelectItem>}
                        {districts.map((d) => (
                            <SelectItem key={d.id} value={d.id.toString()}>
                                {getDistrictName(d)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
