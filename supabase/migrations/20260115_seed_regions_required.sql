-- ========================================
-- SEED: Добавление недостающих регионов Узбекистана
-- Применить: supabase db push или Supabase SQL Editor
-- ========================================

-- Проверяем какие регионы уже есть и добавляем недостающие
-- Используем ON CONFLICT DO NOTHING чтобы не дублировать

INSERT INTO regions (name_uz, name_ru, slug) VALUES
  ('Andijon viloyati', 'Андижанская область', 'andijon'),
  ('Buxoro viloyati', 'Бухарская область', 'buxoro'),
  ('Farg''ona viloyati', 'Ферганская область', 'fargona'),
  ('Jizzax viloyati', 'Джизакская область', 'jizzax'),
  ('Xorazm viloyati', 'Хорезмская область', 'xorazm'),
  ('Namangan viloyati', 'Наманганская область', 'namangan'),
  ('Navoiy viloyati', 'Навоийская область', 'navoiy'),
  ('Qashqadaryo viloyati', 'Кашкадарьинская область', 'qashqadaryo'),
  ('Qoraqalpog''iston Respublikasi', 'Республика Каракалпакстан', 'qoraqalpogiston'),
  ('Samarqand viloyati', 'Самаркандская область', 'samarqand'),
  ('Sirdaryo viloyati', 'Сырдарьинская область', 'sirdaryo'),
  ('Surxondaryo viloyati', 'Сурхандарьинская область', 'surxondaryo'),
  ('Toshkent viloyati', 'Ташкентская область', 'toshkent-viloyat'),
  ('Toshkent shahri', 'Город Ташкент', 'toshkent-shahar')
ON CONFLICT (slug) DO UPDATE SET
  name_uz = EXCLUDED.name_uz,
  name_ru = EXCLUDED.name_ru;

-- Если slug не уникальный, попробуем по name_uz
-- Альтернативный вариант если нет уникального индекса:
-- DO NOTHING вместо DO UPDATE

-- Проверка результата:
-- SELECT id, name_uz, name_ru, slug FROM regions ORDER BY name_uz;
