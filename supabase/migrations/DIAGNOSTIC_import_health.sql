-- ========================================
-- ДИАГНОСТИКА: Качество импорта вакансий
-- Запустить в Supabase SQL Editor
-- ========================================

-- 1. ОБЩАЯ СТАТИСТИКА ИМПОРТНЫХ ВАКАНСИЙ
SELECT 
    'Всего импортных' as metric,
    COUNT(*) as value
FROM jobs WHERE is_imported = true
UNION ALL
SELECT 
    'С raw_source_json',
    COUNT(*) 
FROM jobs WHERE is_imported = true AND raw_source_json IS NOT NULL
UNION ALL
SELECT 
    'С description_uz',
    COUNT(*) 
FROM jobs WHERE is_imported = true AND description_uz IS NOT NULL AND description_uz != ''
UNION ALL
SELECT 
    'С region_id',
    COUNT(*) 
FROM jobs WHERE is_imported = true AND region_id IS NOT NULL
UNION ALL
SELECT 
    'С district_id',
    COUNT(*) 
FROM jobs WHERE is_imported = true AND district_id IS NOT NULL
UNION ALL
SELECT 
    'Активных импортных',
    COUNT(*) 
FROM jobs WHERE is_imported = true AND is_active = true;

-- 2. ПРОБЛЕМА: region_name есть, region_id нет (lookup не сработал)
SELECT 
    'region_name есть, region_id NULL' as problem,
    COUNT(*) as count
FROM jobs 
WHERE is_imported = true AND region_name IS NOT NULL AND region_id IS NULL;

-- 3. ТОП 20 region_name которые не матчатся к regions.name_uz
SELECT 
    j.region_name,
    COUNT(*) as job_count,
    CASE WHEN r.id IS NULL THEN 'НЕ НАЙДЕН' ELSE 'OK' END as status
FROM jobs j
LEFT JOIN regions r ON LOWER(TRIM(j.region_name)) = LOWER(TRIM(r.name_uz))
WHERE j.is_imported = true
GROUP BY j.region_name, r.id
ORDER BY job_count DESC
LIMIT 20;

-- 4. ДУБЛИ РЕГИОНОВ (критическая проблема)
SELECT 
    name_uz, 
    COUNT(*) as duplicates,
    array_agg(id) as ids,
    array_agg(slug) as slugs
FROM regions 
GROUP BY name_uz 
HAVING COUNT(*) > 1;

-- 5. ПРОВЕРКА DISTRICTS
SELECT 
    'Туманы без region_id' as problem,
    COUNT(*) as count
FROM districts WHERE region_id IS NULL;

-- 6. КАТЕГОРИИ: подсчёт вакансий (для Yo'nalishlar)
SELECT 
    c.name_uz as category,
    COUNT(j.id) as job_count
FROM categories c
LEFT JOIN jobs j ON j.category_id = c.id AND j.is_active = true
GROUP BY c.id, c.name_uz
ORDER BY job_count DESC;

-- 7. ПРИМЕРЫ ИМПОРТНЫХ С ПОЛНЫМИ ДАННЫМИ
SELECT 
    id,
    title_uz,
    region_name,
    district_name,
    region_id,
    district_id,
    raw_source_json IS NOT NULL as has_raw_json,
    description_uz IS NOT NULL as has_description,
    views_count
FROM jobs 
WHERE is_imported = true AND is_active = true
LIMIT 10;

-- 8. RESUMES ДИАГНОСТИКА
SELECT 
    'Всего резюме' as metric,
    COUNT(*) as value
FROM resumes
UNION ALL
SELECT 'is_public=true', COUNT(*) FROM resumes WHERE is_public = true
UNION ALL
SELECT 'status=active', COUNT(*) FROM resumes WHERE status = 'active'
UNION ALL
SELECT 'public + active', COUNT(*) FROM resumes WHERE is_public = true AND status = 'active';

-- 9. RLS POLICIES на resumes
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'resumes';
