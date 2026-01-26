-- ============================================
-- ISHDASIZ Categories Alignment with Osonish.uz
-- ============================================
-- This migration replaces old categories with osonish.uz structure
-- and remaps all existing jobs to new categories

-- Step 1: Backup old categories (for reference)
CREATE TABLE IF NOT EXISTS categories_backup AS SELECT * FROM categories;

-- Step 2: Add missing columns if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='categories' AND column_name='slug') THEN
        ALTER TABLE categories ADD COLUMN slug TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='categories' AND column_name='sort_order') THEN
        ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 99;
    END IF;
END $$;

-- Step 3: Delete old categories
DELETE FROM categories;

-- Step 4: Insert new osonish.uz categories with VALID UUIDs
INSERT INTO categories (id, name_uz, name_ru, slug, icon, sort_order) VALUES
    -- 1. IT - Axborot texnologiyalari
    ('a0000001-0001-4000-8000-000000000001', 'Axborot texnologiyalari', 'Информационные технологии', 'it', 'Monitor', 1),
    
    -- 2. Production - Sanoat va ishlab chiqarish
    ('a0000002-0002-4000-8000-000000000002', 'Sanoat va ishlab chiqarish', 'Промышленность и производство', 'sanoat-ishlab-chiqarish', 'Factory', 2),
    
    -- 3. Services - Xizmatlar
    ('a0000003-0003-4000-8000-000000000003', 'Xizmatlar', 'Услуги', 'xizmatlar', 'Wrench', 3),
    
    -- 4. Education - Ta'lim, madaniyat, sport
    ('a0000004-0004-4000-8000-000000000004', 'Ta''lim, madaniyat, sport', 'Образование, культура, спорт', 'talim-madaniyat-sport', 'GraduationCap', 4),
    
    -- 5. Healthcare - Sog'liqni saqlash
    ('a0000005-0005-4000-8000-000000000005', 'Sog''liqni saqlash', 'Здравоохранение', 'sogliqni-saqlash', 'Heart', 5),
    
    -- 6. Finance - Moliya, iqtisod, boshqaruv
    ('a0000006-0006-4000-8000-000000000006', 'Moliya, iqtisod, boshqaruv', 'Финансы, экономика, управление', 'moliya-iqtisod-boshqaruv', 'Wallet', 6),
    
    -- 7. Construction - Qurilish
    ('a0000007-0007-4000-8000-000000000007', 'Qurilish', 'Строительство', 'qurilish', 'Building2', 7),
    
    -- 8. Agriculture - Qishloq xo'jaligi
    ('a0000008-0008-4000-8000-000000000008', 'Qishloq xo''jaligi', 'Сельское хозяйство', 'qishloq-xojaligi', 'Wheat', 8),
    
    -- 9. Transport
    ('a0000009-0009-4000-8000-000000000009', 'Transport', 'Транспорт', 'transport', 'Truck', 9),
    
    -- 10. Sales & Marketing - Savdo va marketing
    ('a0000010-0010-4000-8000-000000000010', 'Savdo va marketing', 'Продажи и маркетинг', 'savdo-marketing', 'ShoppingBag', 10),
    
    -- 11. Other - Boshqa (fallback)
    ('a0000011-0011-4000-8000-000000000011', 'Boshqa', 'Другое', 'boshqa', 'Briefcase', 99);

-- Step 5: Update existing jobs to new categories based on keywords in title

UPDATE jobs SET category_id = 'a0000001-0001-4000-8000-000000000001'
WHERE (category_id IS NULL OR category_id NOT IN (SELECT id FROM categories))
  AND (
    LOWER(title_uz) ~ 'dasturchi|developer|frontend|backend|react|python|java|web|mobile|programmer|axborot'
    OR LOWER(title_ru) ~ 'разработчик|программист|frontend|backend'
  );

UPDATE jobs SET category_id = 'a0000002-0002-4000-8000-000000000002'
WHERE (category_id IS NULL OR category_id NOT IN (SELECT id FROM categories))
  AND (
    LOWER(title_uz) ~ 'ishlab chiqarish|zavod|fabrika|sanoat|operator|texnolog|mexanik|tikuvchi'
    OR LOWER(title_ru) ~ 'производств|завод|фабрика|оператор|технолог|швея'
  );

UPDATE jobs SET category_id = 'a0000003-0003-4000-8000-000000000003'
WHERE (category_id IS NULL OR category_id NOT IN (SELECT id FROM categories))
  AND (
    LOWER(title_uz) ~ 'oshpaz|ofitsiant|farrosh|qorovul|tozalash|barmen|povar'
    OR LOWER(title_ru) ~ 'повар|официант|уборщик|охранник|бармен'
  );

UPDATE jobs SET category_id = 'a0000004-0004-4000-8000-000000000004'
WHERE (category_id IS NULL OR category_id NOT IN (SELECT id FROM categories))
  AND (
    LOWER(title_uz) ~ 'oqituvchi|ustoz|maktab|universitet|professor|teacher|murabbiy'
    OR LOWER(title_ru) ~ 'учитель|преподаватель|тренер'
  );

UPDATE jobs SET category_id = 'a0000005-0005-4000-8000-000000000005'
WHERE (category_id IS NULL OR category_id NOT IN (SELECT id FROM categories))
  AND (
    LOWER(title_uz) ~ 'shifokor|hamshira|vrach|doctor|stomatolog|farmatsevt|laborant|tibbiyot'
    OR LOWER(title_ru) ~ 'врач|медсестра|доктор|стоматолог|фармацевт'
  );

UPDATE jobs SET category_id = 'a0000006-0006-4000-8000-000000000006'
WHERE (category_id IS NULL OR category_id NOT IN (SELECT id FROM categories))
  AND (
    LOWER(title_uz) ~ 'buxgalter|bank|moliya|audit|hisobchi|direktor|boshqaruv'
    OR LOWER(title_ru) ~ 'бухгалтер|банк|финанс|аудит|директор'
  );

UPDATE jobs SET category_id = 'a0000007-0007-4000-8000-000000000007'
WHERE (category_id IS NULL OR category_id NOT IN (SELECT id FROM categories))
  AND (
    LOWER(title_uz) ~ 'qurilish|builder|ishchi|usta|elektrik|santexnik|slessar'
    OR LOWER(title_ru) ~ 'строител|электрик|сантехник|слесарь|мастер'
  );

UPDATE jobs SET category_id = 'a0000008-0008-4000-8000-000000000008'
WHERE (category_id IS NULL OR category_id NOT IN (SELECT id FROM categories))
  AND (
    LOWER(title_uz) ~ 'qishloq|fermer|dehqon|agro|veterinar|chorva'
    OR LOWER(title_ru) ~ 'фермер|агро|ветеринар|сельско'
  );

UPDATE jobs SET category_id = 'a0000009-0009-4000-8000-000000000009'
WHERE (category_id IS NULL OR category_id NOT IN (SELECT id FROM categories))
  AND (
    LOWER(title_uz) ~ 'haydovchi|driver|kurier|logist|yuk|taksi|transport'
    OR LOWER(title_ru) ~ 'водитель|курьер|логист|такси|транспорт'
  );

UPDATE jobs SET category_id = 'a0000010-0010-4000-8000-000000000010'
WHERE (category_id IS NULL OR category_id NOT IN (SELECT id FROM categories))
  AND (
    LOWER(title_uz) ~ 'sotuvchi|kassir|sales|merchandiser|marketing|savdo|smm|reklama'
    OR LOWER(title_ru) ~ 'продавец|кассир|менеджер по продаж|маркетинг|smm'
  );

-- Step 6: Set remaining jobs to "Boshqa"
UPDATE jobs SET category_id = 'a0000011-0011-4000-8000-000000000011'
WHERE category_id IS NULL OR category_id NOT IN (SELECT id FROM categories);

-- Step 7: Add index and comment
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
COMMENT ON TABLE categories IS 'Job categories aligned with osonish.uz structure (11 categories)';

-- Verify counts
SELECT c.name_uz, COUNT(j.id) as job_count
FROM categories c
LEFT JOIN jobs j ON j.category_id = c.id
GROUP BY c.id, c.name_uz
ORDER BY c.sort_order;
