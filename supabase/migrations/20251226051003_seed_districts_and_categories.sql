/*
  # ISHDASIZ - Seed Districts and Categories

  1. Data
    - All districts and cities of Andijan region
    - 13 job categories with icons
*/

-- Seed Andijan districts and cities
INSERT INTO districts (name_uz, name_ru, type) VALUES
  ('Andijon shahri', 'город Андижан', 'city'),
  ('Xonobod shahri', 'город Ханабад', 'city'),
  ('Andijon tumani', 'Андижанский район', 'district'),
  ('Asaka tumani', 'Асакинский район', 'district'),
  ('Baliqchi tumani', 'Балыкчинский район', 'district'),
  ('Bo''ston tumani', 'Бустанский район', 'district'),
  ('Buloqboshi tumani', 'Булакбашинский район', 'district'),
  ('Izboskan tumani', 'Избасканский район', 'district'),
  ('Jalaquduq tumani', 'Джалакудукский район', 'district'),
  ('Xo''jaobod tumani', 'Ходжаабадский район', 'district'),
  ('Qo''rg''ontepa tumani', 'Кургантепинский район', 'district'),
  ('Marhamat tumani', 'Мархаматский район', 'district'),
  ('Oltinko''l tumani', 'Алтынкульский район', 'district'),
  ('Paxtaobod tumani', 'Пахтаабадский район', 'district'),
  ('Shahrixon tumani', 'Шахриханский район', 'district'),
  ('Ulug''nor tumani', 'Улугнорский район', 'district')
ON CONFLICT DO NOTHING;

-- Seed job categories
INSERT INTO categories (name_uz, name_ru, icon) VALUES
  ('IT va Texnologiyalar', 'IT и Технологии', 'Monitor'),
  ('Ta''lim', 'Образование', 'GraduationCap'),
  ('Sog''liqni saqlash', 'Здравоохранение', 'Heart'),
  ('Qurilish', 'Строительство', 'Building2'),
  ('Qishloq xo''jaligi', 'Сельское хозяйство', 'Wheat'),
  ('Ishlab chiqarish', 'Производство', 'Factory'),
  ('Savdo', 'Торговля', 'ShoppingBag'),
  ('Transport', 'Транспорт', 'Truck'),
  ('Moliya', 'Финансы', 'Wallet'),
  ('Turizm', 'Туризм', 'Plane'),
  ('Xizmatlar', 'Услуги', 'Wrench'),
  ('Davlat xizmati', 'Госслужба', 'Landmark'),
  ('Boshqa', 'Другое', 'Briefcase')
ON CONFLICT DO NOTHING;