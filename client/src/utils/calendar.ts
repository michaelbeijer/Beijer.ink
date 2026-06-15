// Small date helpers for the board calendar / week-grouped kanban.
// Plain Date math — no external dependency. Weeks are Mon–Sun (ISO 8601).

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** Monday of the week containing `d` (local time, normalised to 00:00). */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  return addDays(x, -day);
}

export function endOfWeek(d: Date): Date {
  return addDays(startOfWeek(d), 6);
}

/** ISO 8601 week number (1–53). */
export function isoWeek(d: Date): number {
  const date = startOfDay(d);
  // Thursday of the current ISO week decides the year/week.
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  firstThursday.setDate(
    firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7)
  );
  const diff = date.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

/** Stable key for the week containing `d`, e.g. "2026-W14". */
export function weekKey(d: Date): string {
  const monday = startOfWeek(d);
  // ISO week-year can differ from calendar year near Jan/Dec; use the Thursday's year.
  const thursday = addDays(monday, 3);
  return `${thursday.getFullYear()}-W${String(isoWeek(d)).padStart(2, '0')}`;
}

export function weekLabel(d: Date): string {
  return `Week ${isoWeek(d)}`;
}

/** Short range label for a week, e.g. "30 Mar – 5 Apr". */
export function weekRangeLabel(d: Date): string {
  const a = startOfWeek(d);
  const b = endOfWeek(d);
  const fmt = (x: Date) => x.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${fmt(a)} – ${fmt(b)}`;
}

export interface MonthCell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
}

/** 6×7 grid of days for the month containing `d` (Mon-first), with leading/trailing days. */
export function monthGrid(d: Date): MonthCell[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = startOfWeek(first);
  const today = startOfDay(new Date());
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i);
    cells.push({
      date,
      inMonth: date.getMonth() === d.getMonth(),
      isToday: sameDay(date, today),
    });
  }
  return cells;
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Parse a card's ISO `dueDate` string into a local Date (date-only), or null. */
export function parseDue(dueDate: string | null): Date | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  return isNaN(d.getTime()) ? null : startOfDay(d);
}

/** ISO string (UTC midnight) for a calendar day — matches how the modal stores dates. */
export function dayToISO(d: Date): string {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return utc.toISOString();
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
