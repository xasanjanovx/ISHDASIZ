/** Keep every digit visible so an invalid pasted number cannot become another valid number. */
export function formatUzPhoneInput(value: string): string {
    const digits = value.replace(/\D/g, '');
    const national = /^998\d{9}$/.test(digits) ? digits.slice(3) : digits;
    return [national.slice(0, 2), national.slice(2, 5), national.slice(5, 7), national.slice(7)]
        .filter(Boolean).reduce((formatted, part, index) => formatted + (index === 1 ? ' ' : index > 1 ? '-' : '') + part, '');
}
