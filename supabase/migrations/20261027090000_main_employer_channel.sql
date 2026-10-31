-- Employer vacancies created on ISHDASIZ publish to @ishdasiz.
-- Imported jobs and consented resumes keep their existing regional destinations.
-- No bulk seed: changing the destination does not republish historic listings.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_channel_target(p_snapshot jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN p_snapshot->>'available'='true' THEN CASE WHEN p_snapshot->'entity'->>'source'='local' THEN '@ishdasiz' ELSE CASE p_snapshot->>'region_slug'
 WHEN 'toshkent-shahri' THEN '@ishdasiz_toshkent' WHEN 'toshkent-shahar' THEN '@ishdasiz_toshkent'
 WHEN 'toshkent-viloyati' THEN '@ishdasiz_toshkent_vil' WHEN 'samarqand-viloyati' THEN '@ishdasiz_samarqand'
 WHEN 'navoiy-viloyati' THEN '@ishdasiz_navoiy' WHEN 'qoraqalpogiston-respublikasi' THEN '@ishdasiz_qoraqalpogiston'
 WHEN 'qashqadaryo-viloyati' THEN '@ishdasiz_qashqadaryo' WHEN 'surxondaryo-viloyati' THEN '@ishdasiz_surxondaryo'
 WHEN 'fargona-viloyati' THEN '@ishdasiz_fargona' WHEN 'namangan-viloyati' THEN '@ishdasiz_namangan'
 WHEN 'sirdaryo-viloyati' THEN '@ishdasiz_sirdaryo' WHEN 'jizzax-viloyati' THEN '@ishdasiz_jizzax'
 WHEN 'buxoro-viloyati' THEN '@ishdasiz_buxoro' WHEN 'xorazm-viloyati' THEN '@ishdasiz_xorazm'
 WHEN 'andijon-viloyati' THEN '@ishdasiz_andijon' END END END
$$;

REVOKE ALL ON FUNCTION public.ishdasiz_channel_target(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_channel_target(jsonb) TO service_role;
COMMIT;
