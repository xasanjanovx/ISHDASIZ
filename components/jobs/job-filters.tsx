'use client';

import { useState } from 'react';
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
import { Category, District, Region } from '@/types/database';
import { EMPLOYMENT_TYPES, EXPERIENCE_OPTIONS, EDUCATION_OPTIONS, GENDER_OPTIONS } from '@/lib/constants';
import { Filter, X, ChevronDown, ChevronUp } from '@/components/ui/icons';
import { Checkbox } from '@/components/ui/checkbox';
import { SPECIAL_CATEGORIES } from '@/lib/special-categories';
import { LocationSelect } from '@/components/ui/location-select';
// import { getDistricts } from '@/lib/regions';

interface JobFiltersProps {
  categories: Category[];
  regions: Region[];
  districts?: District[]; // Optional legacy
  selectedCategory: string;
  selectedRegion: string;
  selectedDistrict: string;
  selectedSpecialCategories: string[];
  salaryRange: [number, number];
  selectedEmploymentType: string;
  selectedExperience: string;
  selectedEducation: string;
  selectedGender: string;
  onSpecialCategoriesChange: (categories: string[]) => void;
  onSalaryRangeChange: (range: [number, number]) => void;
  onCategoryChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onEmploymentTypeChange: (value: string) => void;
  onExperienceChange: (value: string) => void;
  onEducationChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onClear: () => void;
}

export function JobFilters({
  categories,
  regions,
  selectedCategory,
  selectedRegion,
  selectedDistrict,
  selectedSpecialCategories,
  salaryRange,
  selectedEmploymentType,
  selectedExperience,
  selectedEducation,
  selectedGender,
  onSpecialCategoriesChange,
  onSalaryRangeChange,
  onCategoryChange,
  onRegionChange,
  onDistrictChange,
  onEmploymentTypeChange,
  onExperienceChange,
  onEducationChange,
  onGenderChange,
  onClear,
}: JobFiltersProps) {
  const { lang, t } = useLanguage();

  // const [districtOptions, setDistrictOptions] = useState<District[]>([]);

  // Fetch districts when region changes - Handled by LocationSelect internally
  /*
  useEffect(() => {
    if (selectedRegion && selectedRegion !== 'all') {
      getDistricts(parseInt(selectedRegion)).then(data => {
        setDistrictOptions(data);
      });
    } else {
      setDistrictOptions([]);
    }
  }, [selectedRegion]);
  */

  const handleRegionChange = (regionId: string) => {
    onRegionChange(regionId);
    onDistrictChange('all'); // Reset district when region changes
  };

  const handleDistrictChange = (districtId: string) => {
    onDistrictChange(districtId);
  };

  const handleSpecialCategoryChange = (slug: string, checked: boolean) => {
    if (checked) {
      onSpecialCategoriesChange([...selectedSpecialCategories, slug]);
    } else {
      onSpecialCategoriesChange(selectedSpecialCategories.filter((s) => s !== slug));
    }
  };

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedRegion !== 'all' ||
    selectedDistrict !== 'all' ||
    selectedEmploymentType !== 'all' ||
    selectedExperience !== 'all' ||
    selectedEducation !== 'all' ||
    selectedGender !== 'all' ||
    selectedSpecialCategories.length > 0 ||
    salaryRange[0] > 0 ||
    salaryRange[1] < 20000000;

  const handleClear = () => {
    onRegionChange('all');
    onDistrictChange('all');
    onClear();
  }



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
              onClick={handleClear}
              className="text-slate-500 hover:text-slate-700 -mr-2"
            >
              <X className="w-4 h-4 mr-1" />
              {t.filters.clear}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Location Select (Region & District) */}
        <LocationSelect
          selectedRegion={selectedRegion}
          selectedDistrict={selectedDistrict}
          onRegionChange={handleRegionChange}
          onDistrictChange={handleDistrictChange}
          regions={regions}
          showAllOption={true}
          className="grid-cols-1 gap-2" // Vertical stack for sidebar
          showLabels={true} // Labels handled by LocationSelect
        />

        {/* 3. Category - Most important */}
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

        {/* 4. Employment Type */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t.filters.employmentType}</Label>
          <Select value={selectedEmploymentType} onValueChange={onEmploymentTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {lang === 'uz' ? 'Barcha turlar' : 'Все типы'}
              </SelectItem>
              {EMPLOYMENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t.employmentTypes[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Все фильтры показываются сразу без accordion */}
        <>
          {/* 5. Salary */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t.filters.salary}</Label>
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

          {/* 6. Experience */}
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

          {/* 7. Education */}
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
                  {lang === 'uz' ? 'Ahamiyatsiz' : 'Не важно'}
                </SelectItem>
                {EDUCATION_OPTIONS.filter(l => l.value !== 'any').map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {lang === 'uz' ? level.label_uz : level.label_ru}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 8. Gender */}
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
                {GENDER_OPTIONS.filter(o => o.value !== 'any').map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {lang === 'uz' ? option.label_uz : option.label_ru}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 9. Special Categories - вынесены за аккордеон */}
        </>
        <div className="space-y-3 pt-2 border-t">
          <Label className="text-sm font-medium">
            {lang === 'uz' ? 'Alohida toifalar' : 'Особые категории'}
          </Label>
          <div className="space-y-2.5">
            {SPECIAL_CATEGORIES.map((cat) => (
              <div key={cat.slug} className="flex items-start space-x-2">
                <Checkbox
                  id={`cat-${cat.slug}`}
                  checked={selectedSpecialCategories.includes(cat.slug)}
                  onCheckedChange={(checked) => handleSpecialCategoryChange(cat.slug, checked as boolean)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={`cat-${cat.slug}`}
                  className="text-sm font-normal leading-tight cursor-pointer text-slate-600"
                >
                  {lang === 'uz' ? cat.label_uz : cat.label_ru}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
