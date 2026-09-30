/** Timezone helpers using Intl — no extra date library. */

export const DEFAULT_TZ = "America/New_York";

const WEEKDAY_NUM: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export interface ZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  date: string;
}

function partMap(timeZone: string, utcMs: number): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const out: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out;
}

export function partsInZone(timeZone: string, utcMs = Date.now()): ZoneParts {
  const p = partMap(timeZone || DEFAULT_TZ, utcMs);
  const weekday = WEEKDAY_NUM[(p.weekday || "sun").toLowerCase().slice(0, 3)] ?? 0;
  const year = Number(p.year);
  const month = Number(p.month);
  const day = Number(p.day);
  return {
    year,
    month,
    day,
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday,
    date: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function offsetMs(timeZone: string, utcMs: number): number {
  const p = partMap(timeZone, utcMs);
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUTC - utcMs;
}

/** Convert a wall-clock time in `timeZone` to a UTC epoch. */
export function zonedWallToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  const tz = timeZone || DEFAULT_TZ;
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const utc = guess - offsetMs(tz, guess);
  const again = guess - offsetMs(tz, utc);
  return again;
}

function addCalendarDays(year: number, month: number, day: number, n: number) {
  const dt = new Date(Date.UTC(year, month - 1, day + n));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

export function dateKeyInZone(timeZone: string, utcMs = Date.now()): string {
  return partsInZone(timeZone || DEFAULT_TZ, utcMs).date;
}

export function addDaysInZone(timeZone: string, utcMs: number, days: number): number {
  const tz = timeZone || DEFAULT_TZ;
  const p = partsInZone(tz, utcMs);
  const n = addCalendarDays(p.year, p.month, p.day, days);
  return zonedWallToUtc(tz, n.year, n.month, n.day, p.hour, p.minute);
}

export function startOfDayInZone(timeZone: string, utcMs = Date.now()): number {
  const tz = timeZone || DEFAULT_TZ;
  const p = partsInZone(tz, utcMs);
  return zonedWallToUtc(tz, p.year, p.month, p.day, 0, 0);
}

export function isSameDayInZone(a: number, b: number, timeZone: string): boolean {
  return dateKeyInZone(timeZone, a) === dateKeyInZone(timeZone, b);
}

export function formatClockInZone(ts: number, timeZone: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timeZone || DEFAULT_TZ,
  });
}

export function formatWeekdayInZone(ts: number, timeZone: string): string {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: timeZone || DEFAULT_TZ,
  });
}

/** Next occurrence of hour:minute in the timezone, optionally filtered by weekday. */
export function nextAtInZone(
  hour: number,
  minute: number,
  timeZone: string,
  filter?: (weekday: number) => boolean,
  now = Date.now(),
): number {
  const tz = timeZone || DEFAULT_TZ;
  const p = partsInZone(tz, now);
  let y = p.year;
  let mo = p.month;
  let d = p.day;
  let candidate = zonedWallToUtc(tz, y, mo, d, hour, minute);
  if (candidate <= now) {
    const n = addCalendarDays(y, mo, d, 1);
    y = n.year;
    mo = n.month;
    d = n.day;
    candidate = zonedWallToUtc(tz, y, mo, d, hour, minute);
  }
  let guard = 0;
  while (filter && !filter(partsInZone(tz, candidate).weekday) && guard++ < 14) {
    const n = addCalendarDays(y, mo, d, 1);
    y = n.year;
    mo = n.month;
    d = n.day;
    candidate = zonedWallToUtc(tz, y, mo, d, hour, minute);
  }
  return candidate;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
