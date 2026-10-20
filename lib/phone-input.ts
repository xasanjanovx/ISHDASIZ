/** Accept a pasted Uzbek number as well as the nine-digit local input. */
export function formatLocalPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = (digits.length > 9 && digits.startsWith("998") ? digits.slice(3) : digits).slice(0, 9);
  return [local.slice(0, 2), local.slice(2, 5), local.slice(5, 7), local.slice(7, 9)]
    .filter(Boolean).map((part, index) => index === 0 ? part : `${index === 1 ? " " : "-"}${part}`).join("");
}
