/**
 * Local calendar-day model for date-only product fields (YYYY-MM-DD).
 * Never parse YYYY-MM-DD with `new Date(string)` — that is UTC midnight, which
 * shifts the local calendar day in many timezones.
 */

export type CalendarDay = string

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isCalendarDay(value: string): value is CalendarDay {
  if (!DAY_RE.test(value)) return false
  const parts = parseCalendarDay(value)
  if (!parts) return false
  const probe = new Date(parts.y, parts.m - 1, parts.d)
  return (
    probe.getFullYear() === parts.y &&
    probe.getMonth() === parts.m - 1 &&
    probe.getDate() === parts.d
  )
}

export function parseCalendarDay(
  value: string,
): { y: number; m: number; d: number } | null {
  const m = DAY_RE.exec(value.trim())
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

/** Local calendar day of an instant (browser / provided timezone offset). */
export function calendarDayFromInstant(asOf: Date = new Date()): CalendarDay {
  const y = asOf.getFullYear()
  const m = String(asOf.getMonth() + 1).padStart(2, '0')
  const d = String(asOf.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function compareCalendarDays(a: CalendarDay, b: CalendarDay): number {
  return a.localeCompare(b)
}

/** true when `day` is today or earlier on the local calendar of `asOf`. */
export function isOnOrBeforeCalendarDay(
  day: CalendarDay,
  asOf: Date = new Date(),
): boolean {
  if (!isCalendarDay(day)) return false
  return compareCalendarDays(day, calendarDayFromInstant(asOf)) <= 0
}

export function isBeforeCalendarDay(
  day: CalendarDay,
  asOf: Date = new Date(),
): boolean {
  if (!isCalendarDay(day)) return false
  return compareCalendarDays(day, calendarDayFromInstant(asOf)) < 0
}

export function isSameCalendarDay(
  day: CalendarDay,
  asOf: Date = new Date(),
): boolean {
  if (!isCalendarDay(day)) return false
  return compareCalendarDays(day, calendarDayFromInstant(asOf)) === 0
}

export function isAfterCalendarDay(
  day: CalendarDay,
  asOf: Date = new Date(),
): boolean {
  if (!isCalendarDay(day)) return false
  return compareCalendarDays(day, calendarDayFromInstant(asOf)) > 0
}

/**
 * Sort key for mixed ISO timestamps and date-only strings.
 * Date-only events sort as that local day (lexicographic YYYY-MM-DD prefix).
 */
export function temporalSortKey(at: string): string {
  if (isCalendarDay(at)) return `${at}T12:00:00.000`
  return at
}
