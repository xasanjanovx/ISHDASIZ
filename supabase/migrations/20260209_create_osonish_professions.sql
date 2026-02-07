-- Osonish profession dictionary for "Lavozimga yaqin kasb" search
-- Stable local source so bot/site are not blocked by Osonish API auth limits.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS osonish_professions (
    id BIGINT PRIMARY KEY,
    title_uz TEXT NOT NULL,
    title_ru TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    category_title TEXT,
    vacancies_count INTEGER NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMPTZ,
    source TEXT NOT NULL DEFAULT 'osonish',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_osonish_professions_title_uz
    ON osonish_professions (title_uz);

CREATE INDEX IF NOT EXISTS idx_osonish_professions_title_ru
    ON osonish_professions (title_ru);

CREATE INDEX IF NOT EXISTS idx_osonish_professions_category
    ON osonish_professions (category_id);

CREATE INDEX IF NOT EXISTS idx_osonish_professions_vacancies_count
    ON osonish_professions (vacancies_count DESC);

CREATE INDEX IF NOT EXISTS idx_osonish_professions_title_trgm
    ON osonish_professions
    USING GIN ((COALESCE(title_uz, '') || ' ' || COALESCE(title_ru, '')) gin_trgm_ops);

CREATE OR REPLACE FUNCTION update_osonish_professions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_osonish_professions_updated_at ON osonish_professions;
CREATE TRIGGER trg_osonish_professions_updated_at
BEFORE UPDATE ON osonish_professions
FOR EACH ROW
EXECUTE FUNCTION update_osonish_professions_updated_at();
