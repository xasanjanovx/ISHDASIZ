-- ========================================
-- DEDUPE REGIONS: Удаление дублей регионов + обновление FK
-- КРИТИЧЕСКАЯ МИГРАЦИЯ — выполнять первой!
-- Применить: Supabase SQL Editor
-- ========================================

-- ШАГ 0: Диагностика — найти дубли
-- SELECT name_uz, COUNT(*), array_agg(id), array_agg(slug) 
-- FROM regions 
-- GROUP BY name_uz 
-- HAVING COUNT(*) > 1;

-- ШАГ 1: Создать временную таблицу с canonical записями
-- Правило: предпочитаем slug БЕЗ '-viloyati', иначе min(id)
CREATE TEMP TABLE region_canonical AS
SELECT 
    name_uz,
    -- Выбираем canonical: предпочтение slug без -viloyati, иначе min(id)
    (SELECT id FROM regions r2 
     WHERE r2.name_uz = r.name_uz 
     ORDER BY 
        CASE WHEN r2.slug NOT LIKE '%-viloyati' AND r2.slug NOT LIKE '%-shahar' THEN 0 ELSE 1 END,
        id
     LIMIT 1) as canonical_id
FROM regions r
GROUP BY name_uz;

-- ШАГ 2: Обновить jobs.region_id на canonical
UPDATE jobs j
SET region_id = rc.canonical_id
FROM region_canonical rc
JOIN regions r ON r.name_uz = rc.name_uz
WHERE j.region_id = r.id AND r.id != rc.canonical_id;

-- ШАГ 3: Обновить districts.region_id на canonical
UPDATE districts d
SET region_id = rc.canonical_id
FROM region_canonical rc
JOIN regions r ON r.name_uz = rc.name_uz
WHERE d.region_id = r.id AND r.id != rc.canonical_id;

-- ШАГ 4: Обновить resumes.region_id на canonical (ВАЖНО!)
UPDATE resumes res
SET region_id = rc.canonical_id
FROM region_canonical rc
JOIN regions r ON r.name_uz = rc.name_uz
WHERE res.region_id = r.id AND r.id != rc.canonical_id;

-- ШАГ 5: Обновить employer_profiles.region_id на canonical
UPDATE employer_profiles ep
SET region_id = rc.canonical_id
FROM region_canonical rc
JOIN regions r ON r.name_uz = rc.name_uz
WHERE ep.region_id = r.id AND r.id != rc.canonical_id;

-- ШАГ 6: Обновить job_seeker_profiles.region_id если существует
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_seeker_profiles' AND column_name = 'region_id') THEN
        EXECUTE '
            UPDATE job_seeker_profiles jsp
            SET region_id = rc.canonical_id
            FROM region_canonical rc
            JOIN regions r ON r.name_uz = rc.name_uz
            WHERE jsp.region_id = r.id AND r.id != rc.canonical_id
        ';
    END IF;
END $$;

-- ШАГ 7: Удалить дубликаты (не-canonical записи)
DELETE FROM regions r
WHERE EXISTS (
    SELECT 1 FROM region_canonical rc
    WHERE rc.name_uz = r.name_uz AND rc.canonical_id != r.id
);

-- ШАГ 5: Добавить UNIQUE constraint на slug (если ещё нет)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'regions_slug_key'
    ) THEN
        ALTER TABLE regions ADD CONSTRAINT regions_slug_key UNIQUE (slug);
    END IF;
END $$;

-- ШАГ 6: Проверка результата
-- После выполнения этот запрос должен вернуть 0 строк:
-- SELECT name_uz, COUNT(*) 
-- FROM regions 
-- GROUP BY name_uz 
-- HAVING COUNT(*) > 1;

-- Очистка
DROP TABLE IF EXISTS region_canonical;

-- ========================================
-- ПРОВЕРКА ПОСЛЕ ВЫПОЛНЕНИЯ
-- ========================================
-- 1. Нет дублей:
--    SELECT name_uz, COUNT(*) FROM regions GROUP BY name_uz HAVING COUNT(*) > 1;
-- 2. Регионы имеют правильные slug:
--    SELECT id, name_uz, slug FROM regions ORDER BY name_uz;
-- 3. Jobs привязаны к правильным region_id:
--    SELECT region_id, COUNT(*) FROM jobs WHERE is_active=true GROUP BY region_id;
