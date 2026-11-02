import { AccountError, accountFailure, accountResult, isUuid } from '@/lib/auth/account';
import { getAuthClient } from '@/lib/auth/server';
import { JOB_MAP_PAGE_SIZE, jobMapQuery } from '@/lib/job-map-query';
import { publicMapTotal } from '@/lib/job-map-total';

export const dynamic = 'force-dynamic';
export const maxDuration = 35;

// Service-role access stays on the server. Return only the public map/card DTO.
const fields = 'id,title_uz,title_ru,company_name,salary_min,salary_max,employment_type,created_at,payment_type,work_mode,is_for_students,is_for_graduates,is_for_disabled,is_for_women,latitude,longitude,address'.split(',');
function project(row: any) {
  if (!isUuid(row?.id) || !Number.isFinite(row.latitude) || Math.abs(row.latitude) > 90
    || !Number.isFinite(row.longitude) || Math.abs(row.longitude) > 180) throw new Error('Invalid map point');
  const scalar = (value: unknown) => typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value)) ? value : null;
  const relation = (value: any, keys: string[]) => {
    const item = Array.isArray(value) ? value[0] : value;
    return item ? Object.fromEntries(keys.map(key => [key, scalar(item[key])])) : null;
  };
  return {
    ...Object.fromEntries(fields.map(key => [key, scalar(row[key])])),
    regions: relation(row.regions, ['name_uz', 'name_ru']),
    districts: relation(row.districts, ['name_uz', 'name_ru']),
    categories: relation(row.categories, ['id', 'name_uz', 'name_ru', 'icon']),
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const rawPage = params.get('page') ?? '0';
    const mode=params.get('mode');
    if (Array.from(params.keys()).some(key => !['page','mode'].includes(key)) || params.getAll('page').length > 1 || params.getAll('mode').length>1 || mode!==null&&!['page','count'].includes(mode)
      || !/^(0|[1-9]\d{0,3})$/.test(rawPage)) throw new AccountError(400, 'Некорректная страница / Noto‘g‘ri sahifa');
    const page = Number(rawPage);
    if(mode==='count')return accountResult({total:await publicMapTotal()});
    if(mode==='page'){
      const result=await jobMapQuery(getAuthClient(),page,JOB_MAP_PAGE_SIZE,{count:'none',lookAhead:true}).abortSignal(AbortSignal.timeout(8000));
      if(result.error||!Array.isArray(result.data)||result.data.length>JOB_MAP_PAGE_SIZE+1)throw Error('Map unavailable');
      return accountResult({jobs:result.data.slice(0,JOB_MAP_PAGE_SIZE).map(project),total:null,hasMore:result.data.length>JOB_MAP_PAGE_SIZE});
    }
    // An anonymous database request has a shorter SQL deadline than this visibility/count query.
    // The published-job predicate also excludes closed accounts and unavailable source records.
    const query = jobMapQuery(getAuthClient(), page);
    let result = await query.abortSignal(AbortSignal.timeout(12000));
    // Retry a transient failed read once. Never turn an unavailable map into zero jobs.
    if (result.error?.code === '57014' || result.status >= 500)
      result = await query.abortSignal(AbortSignal.timeout(12000));
    const { data, count, error } = result;
    if (error || !Array.isArray(data) || data.length > JOB_MAP_PAGE_SIZE
      || !Number.isSafeInteger(count) || count! < 0
      || (data.length > 0 && count! < page * JOB_MAP_PAGE_SIZE + data.length)) throw new Error('Map unavailable');
    return accountResult({ jobs: data.map(project), total: count });
  } catch (error) {
    return accountFailure(error);
  }
}
