-- ========================================
-- JOB STATUS COUNTS: Полные счётчики по статусам
-- ========================================

-- 1. VIEW для подсчёта вакансий по статусам (общий)
CREATE OR REPLACE VIEW job_status_counts AS
SELECT 
    COUNT(*) FILTER (WHERE is_active = true AND source_status = 'active') as active,
    COUNT(*) FILTER (WHERE is_active = false AND source_status = 'active') as disabled,
    COUNT(*) FILTER (WHERE source_status = 'removed_at_source') as removed,
    COUNT(*) FILTER (WHERE source_status = 'filled') as filled,
    COUNT(*) as total
FROM jobs;

-- 2. Обновлённый VIEW для категорий с breakdown
CREATE OR REPLACE VIEW category_job_counts AS
SELECT 
    c.id as category_id,
    c.name_uz,
    c.name_ru,
    c.slug,
    c.icon,
    COALESCE(COUNT(j.id) FILTER (WHERE j.is_active = true AND j.source_status = 'active'), 0) as active_count,
    COALESCE(COUNT(j.id) FILTER (WHERE j.is_active = false), 0) as disabled_count,
    COALESCE(COUNT(j.id) FILTER (WHERE j.source_status = 'removed_at_source'), 0) as removed_count,
    COALESCE(COUNT(j.id), 0) as total_count,
    -- Backwards compatible: job_count = active
    COALESCE(COUNT(j.id) FILTER (WHERE j.is_active = true AND j.source_status = 'active'), 0) as job_count
FROM categories c
LEFT JOIN jobs j ON j.category_id = c.id
GROUP BY c.id, c.name_uz, c.name_ru, c.slug, c.icon
ORDER BY active_count DESC;

-- 3. Обновлённый RPC для получения counts
CREATE OR REPLACE FUNCTION get_category_counts()
RETURNS TABLE(
    category_id uuid,
    name_uz text,
    name_ru text,
    slug text,
    icon text,
    active_count bigint,
    disabled_count bigint,
    removed_count bigint,
    total_count bigint,
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
        COALESCE(COUNT(j.id) FILTER (WHERE j.is_active = true AND j.source_status = 'active'), 0) as active_count,
        COALESCE(COUNT(j.id) FILTER (WHERE j.is_active = false), 0) as disabled_count,
        COALESCE(COUNT(j.id) FILTER (WHERE j.source_status = 'removed_at_source'), 0) as removed_count,
        COALESCE(COUNT(j.id), 0) as total_count,
        COALESCE(COUNT(j.id) FILTER (WHERE j.is_active = true AND j.source_status = 'active'), 0) as job_count
    FROM categories c
    LEFT JOIN jobs j ON j.category_id = c.id
    GROUP BY c.id, c.name_uz, c.name_ru, c.slug, c.icon
    ORDER BY active_count DESC;
END;
$$;

-- 4. RPC для получения общих статусов
CREATE OR REPLACE FUNCTION get_job_status_counts()
RETURNS TABLE(
    active bigint,
    disabled bigint,
    removed bigint,
    filled bigint,
    total bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE jobs.is_active = true AND jobs.source_status = 'active'),
        COUNT(*) FILTER (WHERE jobs.is_active = false AND jobs.source_status = 'active'),
        COUNT(*) FILTER (WHERE jobs.source_status = 'removed_at_source'),
        COUNT(*) FILTER (WHERE jobs.source_status = 'filled'),
        COUNT(*)
    FROM jobs;
END;
$$;

-- 5. VIEW для регионов с breakdown
CREATE OR REPLACE VIEW region_job_counts AS
SELECT 
    r.id as region_id,
    r.name_uz,
    r.name_ru,
    r.slug,
    COALESCE(COUNT(j.id) FILTER (WHERE j.is_active = true AND j.source_status = 'active'), 0) as active_count,
    COALESCE(COUNT(j.id), 0) as total_count,
    COALESCE(COUNT(j.id) FILTER (WHERE j.is_active = true AND j.source_status = 'active'), 0) as job_count
FROM regions r
LEFT JOIN jobs j ON j.region_id = r.id
GROUP BY r.id, r.name_uz, r.name_ru, r.slug
ORDER BY active_count DESC;

-- 6. Проверка
-- SELECT * FROM job_status_counts;
-- SELECT * FROM category_job_counts LIMIT 5;
