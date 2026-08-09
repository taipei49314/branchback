import { describe, expect, it } from 'vitest'
import {
  calendarDayFromInstant,
  compareCalendarDays,
  isBeforeCalendarDay,
  isOnOrBeforeCalendarDay,
  isSameCalendarDay,
  isCalendarDay,
  temporalSortKey,
} from './dates'

/** Build a Date at local wall-clock components. */
function localAt(
  y: number,
  m: number,
  d: number,
  h = 12,
  min = 0,
): Date {
  return new Date(y, m - 1, d, h, min, 0, 0)
}

describe('calendar-day semantics', () => {
  it('rejects invalid calendar days', () => {
    expect(isCalendarDay('2025-13-01')).toBe(false)
    expect(isCalendarDay('2025-02-30')).toBe(false)
    expect(isCalendarDay('2025-08-09T00:00:00Z')).toBe(false)
  })

  it('day before due is not on-or-before when asOf is prior day', () => {
    const due = '2025-08-20'
    const asOf = localAt(2025, 8, 19, 23, 59)
    expect(isOnOrBeforeCalendarDay(due, asOf)).toBe(false)
    expect(isBeforeCalendarDay(due, asOf)).toBe(false)
  })

  it('local midnight on due day counts as due', () => {
    const due = '2025-08-20'
    const asOf = localAt(2025, 8, 20, 0, 0)
    expect(isSameCalendarDay(due, asOf)).toBe(true)
    expect(isOnOrBeforeCalendarDay(due, asOf)).toBe(true)
    expect(isBeforeCalendarDay(due, asOf)).toBe(false)
  })

  it('due day afternoon is due', () => {
    const due = '2025-08-20'
    const asOf = localAt(2025, 8, 20, 18, 30)
    expect(isOnOrBeforeCalendarDay(due, asOf)).toBe(true)
  })

  it('day after due is overdue (before today relative to asOf)', () => {
    const due = '2025-08-20'
    const asOf = localAt(2025, 8, 21, 0, 1)
    expect(isBeforeCalendarDay(due, asOf)).toBe(true)
    expect(isOnOrBeforeCalendarDay(due, asOf)).toBe(true)
    expect(isSameCalendarDay(due, asOf)).toBe(false)
  })

  it('does not treat UTC-midnight parse trap as local day', () => {
    // If someone used new Date('2025-08-20'), negative-offset zones see Aug 19 evening.
    // Our model uses the string as the local calendar day directly.
    const due = '2025-08-20'
    const lateEveningPriorLocal = localAt(2025, 8, 19, 20, 0)
    expect(calendarDayFromInstant(lateEveningPriorLocal)).toBe('2025-08-19')
    expect(isOnOrBeforeCalendarDay(due, lateEveningPriorLocal)).toBe(false)
  })

  it('common non-UTC offsets: US Pacific evening before due stays not due', () => {
    // Simulate: local calendar is Aug 19 even if UTC has rolled to Aug 20.
    const asOf = localAt(2025, 8, 19, 23, 30)
    expect(calendarDayFromInstant(asOf)).toBe('2025-08-19')
    expect(isOnOrBeforeCalendarDay('2025-08-20', asOf)).toBe(false)
  })

  it('Tokyo early morning on due day is due', () => {
    const asOf = localAt(2025, 8, 20, 1, 0)
    expect(isSameCalendarDay('2025-08-20', asOf)).toBe(true)
  })

  it('compare and sort keys are stable', () => {
    expect(compareCalendarDays('2025-01-01', '2025-01-02')).toBeLessThan(0)
    expect(temporalSortKey('2025-08-20').startsWith('2025-08-20')).toBe(true)
    expect(temporalSortKey('2025-08-20T15:00:00.000Z').startsWith('2025-08-20')).toBe(
      true,
    )
  })
})
