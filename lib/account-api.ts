export class AccountApiError extends Error {
    constructor(public status: number, public detail?: string) { super(`Account request failed (${status})`); }
}

export async function accountApi<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, { ...init, cache: 'no-store', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...init.headers } });
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new AccountApiError(response.status, typeof body?.error === 'string' ? body.error.slice(0, 500) : undefined);
    }
    return response.json();
}

export function accountErrorText(error: unknown, lang: 'uz' | 'ru') {
    const status = error instanceof AccountApiError ? error.status : 0;
    if (status === 401) return lang === 'ru' ? 'Войдите повторно, чтобы продолжить.' : 'Davom etish uchun qayta kiring.';
    if (status === 423) return lang === 'ru' ? 'Собеседник временно недоступен. Попробуйте позже.' : 'Suhbatdosh vaqtincha mavjud emas. Keyinroq urinib ko‘ring.';
    if (status === 404) return lang === 'ru' ? 'Этот чат недоступен.' : 'Bu chat mavjud emas.';
    if (status === 403 || status === 409) return lang === 'ru' ? 'Откройте чат в соответствующем профиле.' : 'Chatni mos profilingizda oching.';
    return lang === 'ru' ? 'Не удалось загрузить данные. Попробуйте ещё раз.' : 'Ma’lumotlarni yuklab bo‘lmadi. Qayta urinib ko‘ring.';
}
