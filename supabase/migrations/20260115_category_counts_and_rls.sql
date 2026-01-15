-- ========================================
-- YO'NALISHLAR COUNTS: View для подсчёта вакансий по категориям
-- + FIX RLS для публичных резюме
-- ========================================

-- 1. VIEW для подсчёта вакансий по категориям (для главной страницы)
CREATE OR REPLACE VIEW category_job_counts AS
SELECT 
    c.id as category_id,
    c.name_uz,
    c.name_ru,
    c.slug,
    c.icon,
    COALESCE(COUNT(j.id), 0) as job_count
FROM categories c
LEFT JOIN jobs j ON j.category_id = c.id AND j.is_active = true
GROUP BY c.id, c.name_uz, c.name_ru, c.slug, c.icon
ORDER BY job_count DESC;

-- 2. RPC функция для получения counts (альтернатива view)
CREATE OR REPLACE FUNCTION get_category_counts()
RETURNS TABLE(
    category_id uuid,
    name_uz text,
    name_ru text,
    slug text,
    icon text,
    job_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as category_id,
        c.name_uz,
        c.name_ru,
        c.slug,
        c.icon,
        COALESCE(COUNT(j.id), 0) as job_count
    FROM categories c
    LEFT JOIN jobs j ON j.category_id = c.id AND j.is_active = true
    GROUP BY c.id, c.name_uz, c.name_ru, c.slug, c.icon
    ORDER BY job_count DESC;
END;
$$;

-- 3. FIX RLS для публичных резюме — разрешить анонимный SELECT
-- Сначала проверяем, не существует ли уже policy
DO $$
BEGIN
    -- Включаем RLS если ещё не включен
    ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
    
    -- Удаляем старую policy если есть
    DROP POLICY IF EXISTS "Public resumes are viewable by everyone" ON resumes;
    
    -- Создаём новую policy для публичного чтения
    CREATE POLICY "Public resumes are viewable by everyone"
    ON resumes FOR SELECT
    USING (is_public = true);
    
    RAISE NOTICE 'RLS policy for public resumes created successfully';
END $$;

-- 4. Проверка: должны показаться публичные резюме
-- SELECT COUNT(*) FROM resumes WHERE is_public = true;

-- 5. VIEW для region counts (сколько вакансий в каждом регионе)
CREATE OR REPLACE VIEW region_job_counts AS
SELECT 
    r.id as region_id,
    r.name_uz,
    r.name_ru,
    r.slug,
    COALESCE(COUNT(j.id), 0) as job_count
FROM regions r
LEFT JOIN jobs j ON j.region_id = r.id AND j.is_active = true
GROUP BY r.id, r.name_uz, r.name_ru, r.slug
ORDER BY job_count DESC;
