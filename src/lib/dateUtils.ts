/**
 * src/lib/dateUtils.ts
 *
 * Local calendar date helpers to completely avoid UTC / local timezone drift.
 */

/**
 * Returns today's date formatted as YYYY-MM-DD in the user's LOCAL timezone.
 * Never uses Date.prototype.toISOString() which drifts into UTC.
 */
export function getLocalTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD date string into a friendly localized display string
 * without creating a Date object that could shift due to UTC timezone offsets.
 * e.g., "2026-10-13" -> "October 13, 2026"
 */
export function formatLocalDate(dateStr: string): string {
  if (!dateStr) return '—';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const m = parseInt(month, 10) - 1;
    if (m >= 0 && m < 12) {
      return `${monthNames[m]} ${parseInt(day, 10)}, ${year}`;
    }
  }
  return dateStr;
}

/**
 * Formats a YYYY-MM-DD date string into "Weekday, Month Day, Year"
 * e.g., "2026-10-13" -> "Tuesday, October 13, 2026"
 */
export function formatLocalDateWithWeekday(dateStr: string): string {
  if (!dateStr) return '—';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts.map((n) => parseInt(n, 10));
    // Use local year, monthIndex, day constructor
    const d = new Date(year, month - 1, day);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${dayNames[d.getDay()]}, ${monthNames[month - 1]} ${day}, ${year}`;
  }
  return dateStr;
}

/**
 * Adjusts a YYYY-MM-DD date string by a number of days (+1 or -1).
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const parts = dateStr.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
