
/**
 * OsonIsh System Configs Fetcher
 * Retrieves dynamic metadata for Gender, Experience, Education, Work Mode, etc.
 */

export interface ConfigItem {
    id: number;
    code: string;
    name: string;
    value: {
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
    education: Record<number, string>;
    experience: Record<number, string>;
    workMode: Record<number, string>; // Work Type (Remote/Office)
    schedule: Record<number, string>; // 5/2, 6/1
    benefits: Record<number, string>; // Additional benefits / social packages
}

const API_URL = 'https://osonish.uz/api/api/v1/system-configs';
const DEFAULT_HEADERS: Record<string, string> = {
    'Accept': 'application/json',
    'Accept-Language': 'ru,en-US;q=0.9,en;q=0.8,uz;q=0.7',
    'Referer': 'https://osonish.uz/vacancies',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="120", "Chromium";v="120", "Not A(Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
};

export async function fetchOsonishConfigs(): Promise<OsonishConfigs | null> {
    try {
        const response = await fetch(API_URL, { headers: DEFAULT_HEADERS });

        if (!response.ok) return null;

        const json = await response.json();
        const data: ConfigItem[] = json.data;

        const configs: OsonishConfigs = {
            education: {},
            experience: {},
            workMode: {},
            schedule: {},
            benefits: {}
        };

        // Helper to normalize config lists
        const mapList = (code: string, targetMap: Record<number, string>) => {
            const item = data.find(p => p.code === code);
            if (item && item.value.uz) {
                item.value.uz.forEach(val => {
                    targetMap[val.id] = val.name;
                });
            }
        };

        mapList('education_list', configs.education);
        mapList('work_experience_list', configs.experience);
        mapList('work_type_list', configs.workMode);
        mapList('work_schedule_list', configs.schedule);
        mapList('additional_benefits_list', configs.benefits);

        return configs;

    } catch (error) {
        console.error('[Config] Failed to fetch OsonIsh configs:', error);
        return null;
    }
}
