// Shared presentation rule requested for the website and Telegram menu.
export function displayedUsers(count: number | null | undefined): number | null {
  return typeof count === 'number' && count >= 0 && Number.isSafeInteger(count * 2)
    ? count * 2 : null;
}
