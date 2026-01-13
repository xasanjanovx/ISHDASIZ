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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LocationSelect } from '@/components/ui/location-select';
import { Category, Region } from '@/types/database';
import { EXPERIENCE_OPTIONS, EDUCATION_OPTIONS, GENDER_OPTIONS, LANGUAGES_LIST } from '@/lib/constants';
import { Filter, X } from '@/components/ui/icons';

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
        <Card className="sticky top-24">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="w-5 h-5 text-sky-600" />
                        {t.filters.title}
                    </CardTitle>
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClear}
                            className="text-slate-500 hover:text-slate-700 -mr-2"
                        >
                            <X className="w-4 h-4 mr-1" />
                            {t.filters.clear}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                {/* 1. Category */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium">{t.filters.category}</Label>
                    <Select value={selectedCategory} onValueChange={onCategoryChange}>
                        <SelectTrigger>
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

                {/* Location Select */}
                <LocationSelect
                    selectedRegion={selectedRegion}
                    selectedDistrict={selectedDistrict}
                    onRegionChange={onRegionChange}
                    onDistrictChange={onDistrictChange}
                    regions={regions}
                    showAllOption={true}
                    className="grid-cols-1 gap-2"
                    showLabels={true}
                />

                {/* 3. Salary Expectation */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">{lang === 'uz' ? 'Kutilayotgan maosh' : 'Ожидаемая зарплата'}</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            type="number"
                            placeholder={lang === 'uz' ? 'Dan' : 'От'}
                            value={salaryRange[0] === 0 ? '' : salaryRange[0]}
                            onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) : 0;
                                onSalaryRangeChange([val, salaryRange[1]]);
                            }}
                            className="h-10"
                        />
                        <Input
                            type="number"
                            placeholder={lang === 'uz' ? 'Gacha' : 'До'}
                            value={salaryRange[1] >= 20000000 ? '' : salaryRange[1]}
                            onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) : 20000000;
                                onSalaryRangeChange([salaryRange[0], val]);
                            }}
                            className="h-10"
                        />
                    </div>
                </div>

                {/* 4. Experience */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium">
                        {lang === 'uz' ? 'Tajriba' : 'Опыт работы'}
                    </Label>
                    <Select value={selectedExperience} onValueChange={onExperienceChange}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                {lang === 'uz' ? 'Ahamiyatsiz' : 'Любой опыт'}
                            </SelectItem>
                            {EXPERIENCE_OPTIONS.map((level) => (
                                <SelectItem key={level.value} value={level.value}>
                                    {lang === 'uz' ? level.label_uz : level.label_ru}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* 5. Education */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium">
                        {lang === 'uz' ? "Ta'lim" : 'Образование'}
                    </Label>
                    <Select value={selectedEducation} onValueChange={onEducationChange}>
                        <SelectTrigger>
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

                {/* 6. Gender */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium">
                        {lang === 'uz' ? 'Jins' : 'Пол'}
                    </Label>
                    <Select value={selectedGender} onValueChange={onGenderChange}>
                        <SelectTrigger>
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
            </CardContent>
        </Card>
    );
}
