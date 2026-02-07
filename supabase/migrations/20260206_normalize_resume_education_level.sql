-- Normalize invalid education values produced by interrupted bot flows.
-- Canonical values: any, secondary, vocational, incomplete_higher, higher, master, phd

update resumes
set education_level = case
    when education_level is null then null
    when trim(lower(education_level)) in ('', 'done', 'undefined', 'null') then null
    when trim(lower(education_level)) in ('any', 'ahamiyatsiz', 'не важно', 'любой') then 'any'
    when trim(lower(education_level)) similar to '%(magistr|master|магистр)%' then 'master'
    when trim(lower(education_level)) similar to '%(oliy|higher|высш)%' then 'higher'
    when trim(lower(education_level)) similar to '%(incomplete|tugallanmagan|неокончен)%' then 'incomplete_higher'
    when trim(lower(education_level)) similar to '%(orta maxsus|o rta maxsus|vocational|средне специаль)%' then 'vocational'
    when trim(lower(education_level)) similar to '%(orta|o rta|secondary|средн)%' then 'secondary'
    else education_level
end
where education_level is not null;

update job_seeker_profiles
set education_level = case
    when education_level is null then null
    when trim(lower(education_level)) in ('', 'done', 'undefined', 'null') then null
    when trim(lower(education_level)) in ('any', 'ahamiyatsiz', 'не важно', 'любой') then 'any'
    when trim(lower(education_level)) similar to '%(magistr|master|магистр)%' then 'master'
    when trim(lower(education_level)) similar to '%(oliy|higher|высш)%' then 'higher'
    when trim(lower(education_level)) similar to '%(incomplete|tugallanmagan|неокончен)%' then 'incomplete_higher'
    when trim(lower(education_level)) similar to '%(orta maxsus|o rta maxsus|vocational|средне специаль)%' then 'vocational'
    when trim(lower(education_level)) similar to '%(orta|o rta|secondary|средн)%' then 'secondary'
    else education_level
end
where education_level is not null;
