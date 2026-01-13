-- 1. Create regions table
CREATE TABLE IF NOT EXISTS regions (
  id SERIAL PRIMARY KEY,
  name_uz VARCHAR(100) NOT NULL,
  name_ru VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL
);

-- 2. Add region_id to districts
ALTER TABLE districts ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id) ON DELETE CASCADE;

-- 3. Add region_id to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id) ON DELETE SET NULL;

-- 4. Initial Seed for Regions (Upsert based on slug)
INSERT INTO regions (name_uz, name_ru, slug) VALUES
('Toshkent shahri', 'г. Ташкент', 'toshkent-shahri'),
('Toshkent viloyati', 'Ташкентская область', 'toshkent-viloyati'),
('Andijon viloyati', 'Андижанская область', 'andijon-viloyati'),
('Buxoro viloyati', 'Бухарская область', 'buxoro-viloyati'),
('Farg''ona viloyati', 'Ферганская область', 'fargona-viloyati'),
('Jizzax viloyati', 'Джизакская область', 'jizzax-viloyati'),
('Xorazm viloyati', 'Хорезмская область', 'xorazm-viloyati'),
('Namangan viloyati', 'Наманганская область', 'namangan-viloyati'),
('Navoiy viloyati', 'Навоийская область', 'navoiy-viloyati'),
('Qashqadaryo viloyati', 'Кашкадарьинская область', 'qashqadaryo-viloyati'),
('Samarqand viloyati', 'Самаркандская область', 'samarqand-viloyati'),
('Sirdaryo viloyati', 'Сырдарьинская область', 'sirdaryo-viloyati'),
('Surxondaryo viloyati', 'Сурхандарьинская область', 'surxondaryo-viloyati'),
('Qoraqalpog''iston Respublikasi', 'Республика Каракалпакстан', 'qoraqalpogiston-respublikasi')
ON CONFLICT (slug) DO UPDATE SET 
  name_uz = EXCLUDED.name_uz,
  name_ru = EXCLUDED.name_ru;

-- 5. Seed Districts (Using a temporary function regarding readability, doing block insertions by looking up region_id)

DO $$
DECLARE
  r_id INTEGER;
BEGIN
  -- Toshkent shahri
  SELECT id INTO r_id FROM regions WHERE slug = 'toshkent-shahri';
  IF r_id IS NOT NULL THEN
    INSERT INTO districts (name_uz, name_ru, region_id) VALUES
    ('Bektemir tumani', 'Бектемирский район', r_id),
    ('Chilonzor tumani', 'Чиланзарский район', r_id),
    ('Mirobod tumani', 'Мирабадский район', r_id),
    ('Mirzo Ulug''bek tumani', 'Мирзо-Улугбекский район', r_id),
    ('Olmazor tumani', 'Алмазарский район', r_id),
    ('Sergeli tumani', 'Сергелийский район', r_id),
    ('Shayxontohur tumani', 'Шайхантахурский район', r_id),
    ('Uchtepa tumani', 'Учтепинский район', r_id),
    ('Yakkasaroy tumani', 'Яккасарайский район', r_id),
    ('Yangihayot tumani', 'Янгихаётский район', r_id),
    ('Yashnobod tumani', 'Яшнабадский район', r_id),
    ('Yunusobod tumani', 'Юнусабадский район', r_id)
    ON CONFLICT DO NOTHING; -- Assuming name_uz might be unique or we just append. If strict uniqueness needed, add constraint.
  END IF;

  -- Toshkent viloyati
  SELECT id INTO r_id FROM regions WHERE slug = 'toshkent-viloyati';
  IF r_id IS NOT NULL THEN
    INSERT INTO districts (name_uz, name_ru, region_id) VALUES
    ('Angren shahri', 'г. Ангрен', r_id),
    ('Bekobod shahri', 'г. Бекабад', r_id),
    ('Bekobod tumani', 'Бекабадский район', r_id),
    ('Bo''ka tumani', 'Букинский район', r_id),
    ('Bo''stonliq tumani', 'Бостанлыкский район', r_id),
    ('Chinoz tumani', 'Чиназский район', r_id),
    ('Chirchiq shahri', 'г. Чирчик', r_id),
    ('Ohangaron shahri', 'г. Ахангаран', r_id),
    ('Ohangaron tumani', 'Ахангаранский район', r_id),
    ('Olmaliq shahri', 'г. Алмалык', r_id),
    ('Oqqo''rg''on tumani', 'Аккурганский район', r_id),
    ('Parkent tumani', 'Паркентский район', r_id),
    ('Piskent tumani', 'Пскентский район', r_id),
    ('Qibray tumani', 'Кибрайский район', r_id),
    ('Quyi Chirchiq tumani', 'Куйичирчикский район', r_id),
    ('Toshkent tumani', 'Ташкентский район', r_id),
    ('Yangiyo''l shahri', 'г. Янгиюль', r_id),
    ('Yangiyo''l tumani', 'Янгиюльский район', r_id),
    ('Yuqori Chirchiq tumani', 'Юкоричирчикский район', r_id),
    ('Zangiota tumani', 'Зангиатинский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Andijon viloyati
  SELECT id INTO r_id FROM regions WHERE slug = 'andijon-viloyati';
  IF r_id IS NOT NULL THEN
    INSERT INTO districts (name_uz, name_ru, region_id) VALUES
    ('Andijon shahri', 'г. Андижан', r_id),
    ('Xonobod shahri', 'г. Ханабад', r_id),
    ('Andijon tumani', 'Андижанский район', r_id),
    ('Asaka tumani', 'Асакинский район', r_id),
    ('Baliqchi tumani', 'Балыкчинский район', r_id),
    ('Bo''z tumani', 'Бозский район', r_id),
    ('Buloqboshi tumani', 'Булакбашинский район', r_id),
    ('Izboskan tumani', 'Избасканский район', r_id),
    ('Jalaquduq tumani', 'Жалакудукский район', r_id),
    ('Marhamat tumani', 'Мархаматский район', r_id),
    ('Oltinko''l tumani', 'Алтынкульский район', r_id),
    ('Paxtaobod tumani', 'Пахтаабадский район', r_id),
    ('Qo''rg''ontepa tumani', 'Кургантепинский район', r_id),
    ('Shahrixon tumani', 'Шахриханский район', r_id),
    ('Ulug''nor tumani', 'Улугнорский район', r_id),
    ('Xo''jaobod tumani', 'Ходжаабадский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Buxoro viloyati
  SELECT id INTO r_id FROM regions WHERE slug = 'buxoro-viloyati';
  IF r_id IS NOT NULL THEN
    INSERT INTO districts (name_uz, name_ru, region_id) VALUES
    ('Buxoro shahri', 'г. Бухара', r_id),
    ('Kogon shahri', 'г. Каган', r_id),
    ('Buxoro tumani', 'Бухарский район', r_id),
    ('G''ijduvon tumani', 'Гиждуванский район', r_id),
    ('Jondor tumani', 'Жондорский район', r_id),
    ('Kogon tumani', 'Каганский район', r_id),
    ('Olot tumani', 'Алатский район', r_id),
    ('Peshku tumani', 'Пешкунский район', r_id),
    ('Qorako''l tumani', 'Каракульский район', r_id),
    ('Qorovulbozor tumani', 'Караулбазарский район', r_id),
    ('Romitan tumani', 'Ромитанский район', r_id),
    ('Shofirkon tumani', 'Шафирканский район', r_id),
    ('Vobkent tumani', 'Вабкентский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Farg'ona viloyati
  SELECT id INTO r_id FROM regions WHERE slug = 'fargona-viloyati';
  IF r_id IS NOT NULL THEN
    INSERT INTO districts (name_uz, name_ru, region_id) VALUES
    ('Farg''ona shahri', 'г. Фергана', r_id),
    ('Marg''ilon shahri', 'г. Маргилан', r_id),
    ('Qo''qon shahri', 'г. Коканд', r_id),
    ('Quvasoy shahri', 'г. Кувасай', r_id),
    ('Oltiariq tumani', 'Алтыарыкский район', r_id),
    ('Bag''dod tumani', 'Багдадский район', r_id),
    ('Beshariq tumani', 'Бешарыкский район', r_id),
    ('Buvayda tumani', 'Бувайдинский район', r_id),
    ('Dang''ara tumani', 'Дангаринский район', r_id),
    ('Farg''ona tumani', 'Ферганский район', r_id),
    ('Furqat tumani', 'Фуркатский район', r_id),
    ('Qo''shtepa tumani', 'Куштепинский район', r_id),
    ('Quva tumani', 'Кувинский район', r_id),
    ('Rishton tumani', 'Риштанский район', r_id),
    ('So''x tumani', 'Сохский район', r_id),
    ('Toshloq tumani', 'Ташлакский район', r_id),
    ('Uchko''prik tumani', 'Учкуприкский район', r_id),
    ('Yozyovon tumani', 'Язъяванский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Jizzax viloyati
  SELECT id INTO r_id FROM regions WHERE slug = 'jizzax-viloyati';
  IF r_id IS NOT NULL THEN
    INSERT INTO districts (name_uz, name_ru, region_id) VALUES
    ('Jizzax shahri', 'г. Джизак', r_id),
    ('Arnasoy tumani', 'Арнасайский район', r_id),
    ('Baxmal tumani', 'Бахмальский район', r_id),
    ('Do''stlik tumani', 'Дустликский район', r_id),
    ('Forish tumani', 'Фаришский район', r_id),
    ('G''allaorol tumani', 'Галляаральский район', r_id),
    ('Mirzacho''l tumani', 'Мирзачульский район', r_id),
    ('Paxtakor tumani', 'Пахтакорский район', r_id),
    ('Sharof Rashidov tumani', 'Шараф-Рашидовский район', r_id),
    ('Yangiobod tumani', 'Янгиабадский район', r_id),
    ('Zomin tumani', 'Зааминский район', r_id),
    ('Zafarobod tumani', 'Зафарабадский район', r_id),
    ('Zarbdor tumani', 'Зарбдарский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Xorazm viloyati
  SELECT id INTO r_id FROM regions WHERE slug = 'xorazm-viloyati';
  IF r_id IS NOT NULL THEN
     INSERT INTO districts (name_uz, name_ru, region_id) VALUES
     ('Urganch shahri', 'г. Ургенч', r_id),
     ('Xiva shahri', 'г. Хива', r_id),
     ('Bog''ot tumani', 'Багатский район', r_id),
     ('Gurlan tumani', 'Гурленский район', r_id),
     ('Xonqa tumani', 'Ханкинский район', r_id),
     ('Hazorasp tumani', 'Хазараспский район', r_id),
     ('Xiva tumani', 'Хивинский район', r_id),
     ('Qo''shko''pir tumani', 'Кошкупырский район', r_id),
     ('Shovot tumani', 'Шаватский район', r_id),
     ('Urganch tumani', 'Ургенчский район', r_id),
     ('Yangiariq tumani', 'Янгиарыкский район', r_id),
     ('Yangibozor tumani', 'Янгибазарский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Namangan viloyati
  SELECT id INTO r_id FROM regions WHERE slug = 'namangan-viloyati';
  IF r_id IS NOT NULL THEN
    INSERT INTO districts (name_uz, name_ru, region_id) VALUES
    ('Namangan shahri', 'г. Наманган', r_id),
    ('Chortoq tumani', 'Чартакский район', r_id),
    ('Chust tumani', 'Чустский район', r_id),
    ('Kosonsoy tumani', 'Касансайский район', r_id),
    ('Mingbuloq tumani', 'Мингбулакский район', r_id),
    ('Namangan tumani', 'Наманганский район', r_id),
    ('Norin tumani', 'Нарынский район', r_id),
    ('Pop tumani', 'Папский район', r_id),
    ('To''raqo''rg''on tumani', 'Туракурганский район', r_id),
    ('Uchqo''rg''on tumani', 'Учкурганский район', r_id),
    ('Uychi tumani', 'Уйчинский район', r_id),
    ('Yangiqo''rg''on tumani', 'Янгикурганский район', r_id),
    ('Davlatobod tumani', 'Давлатабадский район', r_id),
    ('Yangi Namangan tumani', 'Янги Наманганский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Navoiy viloyati
  SELECT id INTO r_id FROM regions WHERE slug = 'navoiy-viloyati';
  IF r_id IS NOT NULL THEN
    INSERT INTO districts (name_uz, name_ru, region_id) VALUES
    ('Navoiy shahri', 'г. Навои', r_id),
    ('Zarafshon shahri', 'г. Зарафшан', r_id),
    ('Konimex tumani', 'Канимехский район', r_id),
    ('Karmana tumani', 'Карманинский район', r_id),
    ('Qiziltepa tumani', 'Кызылтепинский район', r_id),
    ('Xatirchi tumani', 'Хатырчинский район', r_id),
    ('Navbahor tumani', 'Навбахорский район', r_id),
    ('Nurota tumani', 'Нуратинский район', r_id),
    ('Tomdi tumani', 'Тамдынский район', r_id),
    ('Uchquduq tumani', 'Учкудукский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Qashqadaryo viloyati
  SELECT id INTO r_id FROM regions WHERE slug = 'qashqadaryo-viloyati';
  IF r_id IS NOT NULL THEN
    INSERT INTO districts (name_uz, name_ru, region_id) VALUES
    ('Qarshi shahri', 'г. Карши', r_id),
    ('Shahrisabz shahri', 'г. Шахрисабз', r_id),
    ('Chiroqchi tumani', 'Чиракчинский район', r_id),
    ('Dehqonobod tumani', 'Дехканабадский район', r_id),
    ('G''uzor tumani', 'Гузарский район', r_id),
    ('Qamashi tumani', 'Камашинский район', r_id),
    ('Qarshi tumani', 'Каршинский район', r_id),
    ('Koson tumani', 'Касанский район', r_id),
    ('Kasbi tumani', 'Касбинский район', r_id),
    ('Kitob tumani', 'Китабский район', r_id),
    ('Mirishkor tumani', 'Миришкорский район', r_id),
    ('Muborak tumani', 'Мубаракский район', r_id),
    ('Nishon tumani', 'Нишанский район', r_id),
    ('Shahrisabz tumani', 'Шахрисабзский район', r_id),
    ('Yakkabog'' tumani', 'Яккабагский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Samarqand viloyati
  SELECT id INTO r_id FROM regions WHERE slug = 'samarqand-viloyati';
  IF r_id IS NOT NULL THEN
    INSERT INTO districts (name_uz, name_ru, region_id) VALUES
    ('Samarqand shahri', 'г. Самарканд', r_id),
    ('Kattaqo''rg''on shahri', 'г. Каттакурган', r_id),
    ('Bulung''ur tumani', 'Булунгурский район', r_id),
    ('Ishtixon tumani', 'Иштыханский район', r_id),
    ('Jomboy tumani', 'Джамбайский район', r_id),
    ('Kattaqo''rg''on tumani', 'Каттакурганский район', r_id),
    ('Qo''shrabot tumani', 'Кошрабадский район', r_id),
    ('Narpay tumani', 'Нарпайский район', r_id),
    ('Nurobod tumani', 'Нурабадский район', r_id),
    ('Oqdaryo tumani', 'Акдарьинский район', r_id),
    ('Paxtachi tumani', 'Пахтачийский район', r_id),
    ('Payariq tumani', 'Пайарыкский район', r_id),
    ('Pastdarg''om tumani', 'Пастдаргомский район', r_id),
    ('Samarqand tumani', 'Самаркандский район', r_id),
    ('Toyloq tumani', 'Тайлакский район', r_id),
    ('Urgut tumani', 'Ургутский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Sirdaryo viloyati
  SELECT id INTO r_id FROM regions WHERE slug = 'sirdaryo-viloyati';
  IF r_id IS NOT NULL THEN
    INSERT INTO districts (name_uz, name_ru, region_id) VALUES
    ('Guliston shahri', 'г. Гулистан', r_id),
    ('Shirin shahri', 'г. Ширин', r_id),
    ('Yangiyer shahri', 'г. Янгиер', r_id),
    ('Oqoltin tumani', 'Акалтынский район', r_id),
    ('Boyovut tumani', 'Баяутский район', r_id),
    ('Guliston tumani', 'Гулистанский район', r_id),
    ('Xovos tumani', 'Хавастский район', r_id),
    ('Mirzaobod tumani', 'Мирзаабадский район', r_id),
    ('Sayxunobod tumani', 'Сайхунабадский район', r_id),
    ('Sardoba tumani', 'Сардобинский район', r_id),
    ('Sirdaryo tumani', 'Сырдарьинский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Surxondaryo viloyati
  SELECT id INTO r_id FROM regions WHERE slug = 'surxondaryo-viloyati';
  IF r_id IS NOT NULL THEN
    INSERT INTO districts (name_uz, name_ru, region_id) VALUES
    ('Termiz shahri', 'г. Термез', r_id),
    ('Angor tumani', 'Ангорский район', r_id),
    ('Boysun tumani', 'Байсунский район', r_id),
    ('Denov tumani', 'Денауский район', r_id),
    ('Jarqo''rg''on tumani', 'Джаркурганский район', r_id),
    ('Muzrabot tumani', 'Музрабадский район', r_id),
    ('Oltinsoy tumani', 'Алтынсайский район', r_id),
    ('Qiziriq tumani', 'Кизирикский район', r_id),
    ('Qumqo''rg''on tumani', 'Кумкурганский район', r_id),
    ('Sariosiyo tumani', 'Сариасийский район', r_id),
    ('Sherobod tumani', 'Шерабадский район', r_id),
    ('Sho''rchi tumani', 'Шурчинский район', r_id),
    ('Termiz tumani', 'Термезский район', r_id),
    ('Uzun tumani', 'Узунский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Qoraqalpog'iston Respublikasi
  SELECT id INTO r_id FROM regions WHERE slug = 'qoraqalpogiston-respublikasi';
  IF r_id IS NOT NULL THEN
     INSERT INTO districts (name_uz, name_ru, region_id) VALUES
     ('Nukus shahri', 'г. Нукус', r_id),
     ('Amudaryo tumani', 'Амударьинский район', r_id),
     ('Beruniy tumani', 'Берунийский район', r_id),
     ('Chimboy tumani', 'Чимбайский район', r_id),
     ('Ellikqal''a tumani', 'Элликкалинский район', r_id),
     ('Kegeyli tumani', 'Кегейлийский район', r_id),
     ('Mo''ynoq tumani', 'Муйнакский район', r_id),
     ('Nukus tumani', 'Нукусский район', r_id),
     ('Qanliko''l tumani', 'Канлыкульский район', r_id),
     ('Qo''ng''irot tumani', 'Кунградский район', r_id),
     ('Qorao''zak tumani', 'Караузякский район', r_id),
     ('Shumanay tumani', 'Шуманайский район', r_id),
     ('Taxtako''pir tumani', 'Тахтакупырский район', r_id),
     ('To''rtko''l tumani', 'Турткульский район', r_id),
     ('Xo''jayli tumani', 'Ходжейлийский район', r_id)
    ON CONFLICT DO NOTHING;
  END IF;

END $$;
