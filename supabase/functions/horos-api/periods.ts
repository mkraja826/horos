import type { Period } from "./types.ts";

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function integerPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new RangeError(`Unable to calculate timezone ${type}.`);
  return Number(value);
}

function zonedDateParts(timezone: string, date: Date): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return {
    year: integerPart(parts, "year"),
    month: integerPart(parts, "month"),
    day: integerPart(parts, "day"),
    hour: integerPart(parts, "hour"),
    minute: integerPart(parts, "minute"),
    second: integerPart(parts, "second"),
  };
}

function calendarDate(year: number, month: number, day: number): ZonedDateParts {
  const value = new Date(Date.UTC(year, month - 1, day));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  };
}

function sameLocalDate(actual: ZonedDateParts, expected: ZonedDateParts): boolean {
  return actual.year === expected.year && actual.month === expected.month && actual.day === expected.day;
}

function sameLocalDateTime(actual: ZonedDateParts, expected: ZonedDateParts): boolean {
  return sameLocalDate(actual, expected) && actual.hour === expected.hour &&
    actual.minute === expected.minute && actual.second === expected.second;
}

function localDateTimeToUtc(timezone: string, local: ZonedDateParts): Date {
  const targetAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  let candidate = targetAsUtc;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const observed = zonedDateParts(timezone, new Date(candidate));
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const correction = targetAsUtc - observedAsUtc;
    candidate += correction;
    if (correction === 0) return new Date(candidate);
  }

  const corrected = new Date(candidate);
  if (sameLocalDateTime(zonedDateParts(timezone, corrected), local)) return corrected;

  // A few IANA zones historically skipped local midnight during an offset change.
  // In that case, use the first real instant belonging to the requested local date.
  const searchStart = candidate - 6 * 60 * 60 * 1000;
  const searchEnd = candidate + 6 * 60 * 60 * 1000;
  for (let instant = searchStart; instant <= searchEnd; instant += 60_000) {
    if (sameLocalDate(zonedDateParts(timezone, new Date(instant)), local)) {
      return new Date(instant);
    }
  }

  throw new RangeError(`Unable to resolve the next cache boundary in ${timezone}.`);
}

function isoWeekKey(local: ZonedDateParts): string {
  const target = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const isoDay = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - isoDay);
  const isoYear = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function resolveTimezoneAndDate(
  timezoneOrDate: string | Date | undefined,
  date: Date | undefined,
): { timezone: string; date: Date } {
  if (timezoneOrDate instanceof Date) return { timezone: "UTC", date: timezoneOrDate };
  return { timezone: timezoneOrDate ?? "UTC", date: date ?? new Date() };
}

export function localDateInTimezone(timezone: string, date = new Date()): string {
  const local = zonedDateParts(timezone, date);
  return `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
}

export function periodKey(
  period: Period,
  timezoneOrDate?: string | Date,
  date?: Date,
): string {
  const resolved = resolveTimezoneAndDate(timezoneOrDate, date);
  const local = zonedDateParts(resolved.timezone, resolved.date);

  if (period === "daily") return localDateInTimezone(resolved.timezone, resolved.date);
  if (period === "monthly") {
    return `${local.year}-${String(local.month).padStart(2, "0")}`;
  }
  return isoWeekKey(local);
}

export function cacheExpiry(
  period: Period,
  timezoneOrDate?: string | Date,
  date?: Date,
): string {
  const resolved = resolveTimezoneAndDate(timezoneOrDate, date);
  const local = zonedDateParts(resolved.timezone, resolved.date);
  let boundary: ZonedDateParts;

  if (period === "daily") {
    boundary = calendarDate(local.year, local.month, local.day + 1);
  } else if (period === "weekly") {
    const calendar = new Date(Date.UTC(local.year, local.month - 1, local.day));
    const isoDay = calendar.getUTCDay() || 7;
    boundary = calendarDate(local.year, local.month, local.day + (8 - isoDay));
  } else {
    boundary = calendarDate(local.year, local.month + 1, 1);
  }

  return localDateTimeToUtc(resolved.timezone, boundary).toISOString();
}
