export type JobSalaryRange = [number, number | undefined];
export const MAX_JOB_SALARY = 2147483647;

export function parseJobSalaryRange(value: string | null): JobSalaryRange {
    if (!value || !/^\d*-\d*$/.test(value)) return [0, undefined];
    const [from, to] = value.split('-');
    const min = from ? Number(from) : 0, max = to ? Number(to) : undefined;
    if (!Number.isSafeInteger(min) || min > MAX_JOB_SALARY || max !== undefined && (!Number.isSafeInteger(max) || min > max || max > MAX_JOB_SALARY)) return [0, undefined];
    return [min, max];
}

export function parseSalaryRange(value: string | null): [number, number] {
    if (!value || !/^\d+-\d+$/.test(value)) return [0, 20000000];
    const [min, max] = value.split('-').map(Number);
    return Number.isSafeInteger(min) && Number.isSafeInteger(max) && min <= max && max <= 20000000
        ? [min, max] : [0, 20000000];
}

export function parseAgeRange(value: string | null): [number | undefined, number | undefined] {
    if (!value || !/^\d{0,3}-\d{0,3}$/.test(value)) return [undefined, undefined];
    const [min, max] = value.split('-').map(n => n ? Number(n) : undefined);
    if ([min, max].some(n => n !== undefined && (n < 14 || n > 100)) || (min !== undefined && max !== undefined && min > max)) return [undefined, undefined];
    return [min, max];
}
