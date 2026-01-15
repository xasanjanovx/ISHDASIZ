-- ========================================
-- ДИАГНОСТИКА RESUMES И REGIONS
-- Запустить в Supabase SQL Editor
-- ========================================

-- 1. RESUMES: Проверка наличия публичных резюме
SELECT 
    COUNT(*) as total_resumes,
    COUNT(*) FILTER (WHERE is_public = true) as public_resumes,
    COUNT(*) FILTER (WHERE status = 'active') as active_resumes,
    COUNT(*) FILTER (WHERE is_public = true AND status = 'active') as public_and_active
FROM resumes;

-- 2. RESUMES: RLS policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual
FROM pg_policies 
WHERE tablename = 'resumes';

-- 3. REGIONS: Проверка всех регионов
SELECT id, name_uz, name_ru, slug 
FROM regions 
ORDER BY name_uz;

-- 4. REGIONS: Подсчёт вакансий по регионам
SELECT 
    r.id,
    r.name_uz,
    COUNT(j.id) as jobs_count,
    COUNT(j.id) FILTER (WHERE j.is_imported = true) as imported_count
FROM regions r
LEFT JOIN jobs j ON j.region_id = r.id AND j.is_active = true
GROUP BY r.id, r.name_uz
ORDER BY r.name_uz;

-- 5. ВАКАНСИИ БЕЗ region_id
SELECT 
    COUNT(*) as without_region_id,
    COUNT(region_name) as with_region_name_text
FROM jobs 
WHERE is_active = true AND region_id IS NULL;

-- 6. Примеры вакансий с заполненными полями
SELECT 
    id, 
    title_uz,
    region_name,
    district_name,
    views_count,
    work_mode,
    description_uz IS NOT NULL as has_description,
    raw_source_json IS NOT NULL as has_raw_json
FROM jobs 
WHERE is_active = true
LIMIT 5;
