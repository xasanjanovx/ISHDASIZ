'use client';

import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { LocationSelect } from '@/components/ui/location-select';
import { Category, Region } from '@/types/database';
import { EXPERIENCE_OPTIONS, EDUCATION_OPTIONS, GENDER_OPTIONS } from '@/lib/constants';
import { X } from '@/components/ui/icons';

interface ResumeFiltersProps {
    categories: Category[];
    regions: Region[];
    selectedCategory: string;
    selectedRegion: string;
    selectedDistrict: string;
    salaryRange: [number, number];
    selectedExperience: string;
    selectedEducation: string;
    selectedGender: string;
    onSalaryRangeChange: (range: [number, number]) => void;
    onCategoryChange: (value: string) => void;
    onRegionChange: (value: string) => void;
    onDistrictChange: (value: string) => void;
    onExperienceChange: (value: string) => void;
    onEducationChange: (value: string) => void;
    onGenderChange: (value: string) => void;
    onClear: () => void;
}

export function ResumeFilters({
    categories,
    regions,
    selectedCategory,
    selectedRegion,
    selectedDistrict,
    salaryRange,
    selectedExperience,
    selectedEducation,
    selectedGender,
    onSalaryRangeChange,
    onCategoryChange,
    onRegionChange,
    onDistrictChange,
    onExperienceChange,
    onEducationChange,
    onGenderChange,
    onClear,
}: ResumeFiltersProps) {
    const { lang, t } = useLanguage();

    const hasActiveFilters =
        selectedCategory !== 'all' ||
        selectedRegion !== 'all' ||
        selectedDistrict !== 'all' ||
        selectedExperience !== 'all' ||
        selectedEducation !== 'all' ||
        selectedGender !== 'all' ||
        salaryRange[0] > 0 ||
        salaryRange[1] < 20000000;

    return (
        <div className="space-y-4">
            {/* Top row: main filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Category */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t.filters.category}</Label>
                    <Select value={selectedCategory} onValueChange={onCategoryChange}>
                        <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 hover:border-teal-300 transition-colors">
                            <SelectValue placeholder={t.filters.allCategories} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t.filters.allCategories}</SelectItem>
                            {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                    {lang === 'uz' ? cat.name_uz : cat.name_ru}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Location */}
                <div className="col-span-2 sm:col-span-2">
                    <LocationSelect
                        selectedRegion={selectedRegion}
                        selectedDistrict={selectedDistrict}
                        onRegionChange={onRegionChange}
                        onDistrictChange={onDistrictChange}
                        regions={regions}
                        showAllOption={true}
                        className="grid-cols-2 gap-3"
                        showLabels={true}
                    />
                </div>

                {/* Experience */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {lang === 'uz' ? 'Tajriba' : 'Опыт'}
                    </Label>
                    <Select value={selectedExperience} onValueChange={onExperienceChange}>
                        <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 hover:border-teal-300 transition-colors">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                {lang === 'uz' ? 'Ahamiyatsiz' : 'Любой'}
                            </SelectItem>
                            {EXPERIENCE_OPTIONS.map((level) => (
                                <SelectItem key={level.value} value={level.value}>
                                    {lang === 'uz' ? level.label_uz : level.label_ru}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Education */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {lang === 'uz' ? "Ta'lim" : 'Образ.'}
                    </Label>
                    <Select value={selectedEducation} onValueChange={onEducationChange}>
                        <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 hover:border-teal-300 transition-colors">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                {lang === 'uz' ? 'Barchasi' : 'Любое'}
                            </SelectItem>
                            {EDUCATION_OPTIONS.map((level) => (
                                <SelectItem key={level.value} value={level.value}>
                                    {lang === 'uz' ? level.label_uz : level.label_ru}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {lang === 'uz' ? 'Jins' : 'Пол'}
                    </Label>
                    <Select value={selectedGender} onValueChange={onGenderChange}>
                        <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 hover:border-teal-300 transition-colors">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                {lang === 'uz' ? 'Ahamiyatsiz' : 'Любой'}
                            </SelectItem>
                            {GENDER_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {lang === 'uz' ? option.label_uz : option.label_ru}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Salary row + Clear */}
            <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {lang === 'uz' ? 'Maosh (dan)' : 'Зарплата (от)'}
                    </Label>
                    <Input
                        type="number"
                        placeholder={lang === 'uz' ? 'Dan' : 'От'}
                        value={salaryRange[0] === 0 ? '' : salaryRange[0]}
                        onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value) : 0;
                            onSalaryRangeChange([val, salaryRange[1]]);
                        }}
                        className="h-10 w-36 rounded-xl bg-slate-50 border-slate-200 hover:border-teal-300 transition-colors"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {lang === 'uz' ? 'Maosh (gacha)' : 'Зарплата (до)'}
                    </Label>
                    <Input
                        type="number"
                        placeholder={lang === 'uz' ? 'Gacha' : 'До'}
                        value={salaryRange[1] >= 20000000 ? '' : salaryRange[1]}
                        onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value) : 20000000;
                            onSalaryRangeChange([salaryRange[0], val]);
                        }}
                        className="h-10 w-36 rounded-xl bg-slate-50 border-slate-200 hover:border-teal-300 transition-colors"
                    />
                </div>

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClear}
                        className="h-10 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                        <X className="w-4 h-4 mr-1.5" />
                        {t.filters.clear}
                    </Button>
                )}
            </div>
        </div>
    );
}
