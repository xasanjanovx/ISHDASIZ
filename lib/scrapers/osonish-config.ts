/**
 * OsonIsh System Configs Fetcher
 * Retrieves dynamic metadata for Gender, Experience, Education, Work Mode, etc.
 */

export interface ConfigItem {
  id: number;
  code: string;
  name: string;
  value:
    | ConfigValue[]
    | {
        en: any[];
        ru: any[];
        uz: ConfigValue[];
        cyrl: any[];
      };
}

export interface ConfigValue {
  id: number;
  name: string;
  sort: number;
}

export interface OsonishConfigs {
  mainFields?: Array<{ id: number; name: string; name_ru?: string }>;
  education: Record<number, string>;
  experience: Record<number, string>;
  workMode: Record<number, string>; // Work Type (Remote/Office)
  schedule: Record<number, string>; // 5/2, 6/1
  benefits: Record<number, string>; // Additional benefits / social packages
}

const API_BASE_ENV = process.env.OSONISH_API_BASE?.trim();
const trimBase = (value: string) => value.replace(/\/+$/, "");
const toBaseCandidates = (value: string): string[] => {
  const cleaned = trimBase(value);
  if (!cleaned) return [];
  if (cleaned.endsWith("/api/api/v1"))
    return [cleaned, cleaned.replace("/api/api/v1", "/api/v1")];
  if (cleaned.endsWith("/api/v1"))
    return [cleaned, cleaned.replace("/api/v1", "/api/api/v1")];
  return [`${cleaned}/api/v1`, `${cleaned}/api/api/v1`];
};
const API_BASES = Array.from(
  new Set([
    "https://osonish.uz/api/v1",
    "https://osonish.uz/api/api/v1",
    ...(API_BASE_ENV ? toBaseCandidates(API_BASE_ENV) : []),
  ]),
);
const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Accept-Language": "ru,en-US;q=0.9,en;q=0.8,uz;q=0.7",
  Referer: "https://osonish.uz/vacancies",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "sec-ch-ua":
    '"Google Chrome";v="120", "Chromium";v="120", "Not A(Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

const buildHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { ...DEFAULT_HEADERS };
  const cookie = process.env.OSONISH_COOKIE;
  const token =
    process.env.OSONISH_BEARER_TOKEN || process.env.OSONISH_API_TOKEN;
  const userId =
    process.env.OSONISH_USER_ID || process.env.OSONISH_CURRENT_USER_ID;
  if (cookie) headers.Cookie = cookie;
  if (token)
    headers.Authorization = token.startsWith("Bearer ")
      ? token
      : `Bearer ${token}`;
  if (userId) headers["x-current-user-id"] = userId;
  return headers;
};

const buildPublicHeaders = (): Record<string, string> => {
  const headers = buildHeaders();
  delete headers.Cookie;
  delete headers.Authorization;
  delete headers["x-current-user-id"];
  return headers;
};

const hasAuthHeaders = (): boolean => {
  return Boolean(
    process.env.OSONISH_COOKIE ||
      process.env.OSONISH_BEARER_TOKEN ||
      process.env.OSONISH_API_TOKEN ||
      process.env.OSONISH_USER_ID ||
      process.env.OSONISH_CURRENT_USER_ID,
  );
};

export function parseOsonishConfigs(data: unknown): OsonishConfigs {
  if (!Array.isArray(data)) throw new Error("Invalid source configs");
  const configs: OsonishConfigs = {
    education: {},
    experience: {},
    workMode: {},
    schedule: {},
    benefits: {},
  };
  const mapList = (codes: string[], target: Record<number, string>) => {
    const item = data.find((p) => codes.includes(p?.code));
    const values = Array.isArray(item?.value) ? item.value : item?.value?.uz;
    if (!Array.isArray(values)) return;
    for (const value of values) {
      if (
        Number.isSafeInteger(value?.id) &&
        value.id > 0 &&
        typeof value.name === "string" &&
        value.name.trim()
      )
        target[value.id] = value.name.trim();
    }
  };
  mapList(["education_level_list", "education_list"], configs.education);
  mapList(["work_experience_list"], configs.experience);
  mapList(["work_type_list"], configs.workMode);
  mapList(["work_schedule_list"], configs.schedule);
  mapList(["additional_benefits_list"], configs.benefits);
  const directions = data.find(item => item?.code === 'main_fields');
  if (directions) {
    const list = Array.isArray(directions.value) ? directions.value : directions.value?.uz;
    if (!Array.isArray(list) || !list.length || list.length > 200 || list.some(item => !Number.isSafeInteger(item?.id) || item.id < 1 || typeof item.name !== 'string' || !item.name.trim())) throw new Error('Invalid source directions');
    const russian = !Array.isArray(directions.value) && Array.isArray(directions.value?.ru) ? directions.value.ru : [];
    configs.mainFields = list.map(item => ({ id: item.id, name: item.name.trim(), name_ru: russian.find((r: any) => r.id === item.id)?.name }));
  }
  if (
    !Object.keys(configs.experience).length ||
    !Object.keys(configs.workMode).length
  )
    throw new Error("Incomplete source configs");
  return configs;
}

let cached: { value: OsonishConfigs; expires: number } | null = null;
export async function fetchOsonishConfigs(
  parentSignal?: AbortSignal,
): Promise<OsonishConfigs | null> {
  if (parentSignal?.aborted) parentSignal.throwIfAborted();
  if (cached && cached.expires > Date.now()) return cached.value;
  const timeout = AbortSignal.timeout(5000);
  const signals = AbortSignal as typeof AbortSignal & {
    any: (signals: AbortSignal[]) => AbortSignal;
  };
  const signal = parentSignal ? signals.any([parentSignal, timeout]) : timeout;
  try {
    let response: Response | null = null;
    for (const base of API_BASES) {
      response = await fetch(`${base}/system-configs`, {
        headers: buildHeaders(),
        signal,
        cache: "no-store",
      });
      if (response.status === 404 && hasAuthHeaders()) {
        response = await fetch(`${base}/system-configs`, {
          headers: buildPublicHeaders(),
          signal,
          cache: "no-store",
        });
      }
      if (response.status !== 404) break;
    }

    if (!response || !response.ok) return null;

    const json = await response.json();
    if (json.success === false) return null;
    const configs = parseOsonishConfigs(json.data);
    cached = { value: configs, expires: Date.now() + 3600000 };
    return configs;
  } catch {
    if (parentSignal?.aborted) parentSignal.throwIfAborted();
    return null;
  }
}
