import { parseAgeRange, parseSalaryRange } from '@/lib/search-ranges';
import { cleanJobText, normalizeLocation } from '@/lib/text';
import { REGION_COORDINATES } from '@/lib/constants';
it('ignores malformed, inverted or unsafe URL ranges', () => {
 for (const value of ['NaN-1', '3-2', '-1-3', '1-999999999999999999']) expect(parseSalaryRange(value)).toEqual([0, 20000000]);
 expect(parseSalaryRange('1000000-3000000')).toEqual([1000000,3000000]);
 expect(parseAgeRange('30-18')).toEqual([undefined,undefined]);
 expect(parseAgeRange('18-')).toEqual([18,undefined]);
});
it('removes empty imported job sections and decodes readable text', () => {
 expect(cleanJobText('Vazifalar: - -\nTalablar:')).toBe('');
 expect(cleanJobText('<p>Ish&nbsp; &amp; imkoniyat</p>')).toBe('Ish & imkoniyat');
 expect(normalizeLocation('Surxondaryo viloyati vil., Qiziriq tumani')).toBe('Surxondaryo viloyati Qiziriq tumani');
});
it('uses real region IDs for geography', () => {
 expect(Object.keys(REGION_COORDINATES)).toHaveLength(14);
 expect(REGION_COORDINATES[22]).toBeDefined();
 expect(REGION_COORDINATES[12]).toBeDefined();
 expect(REGION_COORDINATES[1]).toBeUndefined();
});
