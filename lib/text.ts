
import { decode } from 'html-entities';

/**
 * Очистка текста вакансии от HTML, лишних пробелов и мусора
 */
export function cleanJobText(text: string | undefined | null): string {
    if (typeof text !== 'string' || !text) return '';

    // 1. Декодируем HTML entities (&nbsp; -> ' ', &amp; -> '&', etc)
    let cleaned = decode(text);

    // 2. Удаляем HTML теги
    cleaned = cleaned.replace(/<[^>]*>/g, ' ');

    // 2.5. Replace non-breaking spaces (may remain after decode)
    cleaned = cleaned.replace(/\u00A0/g, ' ');

    // 3. Удаляем пустые секции вида "Vazifalar: - -" или "Talablar: "
    cleaned = cleaned.replace(/(Vazifalar|Talablar|Sharh|Imkoniyatlar):\s*[-–—]\s*[-–—]/gi, '');
    cleaned = cleaned.replace(/(Vazifalar|Talablar|Sharh|Imkoniyatlar):\s*$/gim, '');

    // 4. Удаляем повторяющиеся пробелы и переносы
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // 5. Если текст слишком короткий или пустой после очистки — возвращаем пустую строку
    if (cleaned.length < 5) return '';

    return cleaned;
}

/**
 * Нормализация location строки
 * Удаляет "vil." и "vil.," ВСЕГДА, а также дублирующие запятые и пробелы
 */
export function normalizeLocation(name: string | undefined | null): string {
    if (!name) return '';

    let cleaned = name;

    // Удаляем "vil.," и "vil." ВСЕГДА — это лишний элемент (с запятой или без)
    cleaned = cleaned.replace(/\s*vil\.\s*,?\s*/gi, ' ');

    // Удаляем "обл.," и "обл." ВСЕГДА
    cleaned = cleaned.replace(/\s*обл\.\s*,?\s*/gi, ' ');

    // Чистим двойные запятые, пробелы перед запятой, лишние пробелы
    cleaned = cleaned
        .replace(/\s+,/g, ',')           // пробел перед запятой
        .replace(/,\s*,/g, ',')          // двойные запятые
        .replace(/\s{2,}/g, ' ')         // множественные пробелы
        .replace(/^\s*,\s*/g, '')        // запятая в начале
        .replace(/\s*,\s*$/g, '')        // запятая в конце
        .trim();

    return cleaned;
}
