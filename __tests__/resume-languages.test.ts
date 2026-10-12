import { decodeResumeLanguage, resumeLanguages } from '@/lib/resume-languages';
import { resumeSkills } from '@/lib/resume-api';
test('JSONB and text[] language representations have the same labels and levels', () => {
  const row = { name: 'english', level: 'advanced' };
  expect(resumeLanguages([row])).toEqual(resumeLanguages([JSON.stringify(row)]));
  expect(decodeResumeLanguage('uzbek')).toBe('uzbek'); expect(resumeLanguages(['uzbek', 'russian'])).toEqual([{ name: 'uzbek' }, { name: 'russian' }]);
});
test('malformed and empty collections do not leak JSON fragments into skills or crash', () => {
  expect(resumeSkills('[]')).toEqual([]); expect(resumeSkills('["JS",{"name":"SQL"}]')).toEqual(['JS', 'SQL']); expect(resumeLanguages([null, 5, '{}'])).toEqual([]);
});
