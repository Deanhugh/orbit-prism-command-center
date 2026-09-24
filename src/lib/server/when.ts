export interface ParsedCadence {
  cadence: string; // human readable
  nextRun: number;
  everyMs: number; // recurrence interval used to compute subsequent runs
}

const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function parseTime(text: string): { h: number; m: number } | null {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

function nextAt(h: number, m: number, filter?: (d: Date) => boolean): number {
  const now = new Date();
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  if (filter) {
    let guard = 0;
    while (!filter(d) && guard++ < 14) d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Detect and parse a cadence from free text. Returns null if none present. */
export function parseCadence(text: string): ParsedCadence | null {
  const t = text.toLowerCase();
  const time = parseTime(t);

  // every N minutes (for filming / demos)
  const everyMin = t.match(/every\s+(\d+)\s*min(?:ute)?s?/);
  if (everyMin) {
    const n = Math.max(1, parseInt(everyMin[1], 10));
    return {
      cadence: `every ${n} minute${n > 1 ? "s" : ""}`,
      nextRun: Date.now() + n * 60000,
      everyMs: n * 60000,
    };
  }

  if (/every\s+hour|hourly/.test(t)) {
    return { cadence: "every hour", nextRun: Date.now() + 3600000, everyMs: 3600000 };
  }

  if (/every\s+weekday|weekdays/.test(t)) {
    const h = time?.h ?? 8;
    const m = time?.m ?? 0;
    return {
      cadence: `every weekday at ${fmt(h, m)}`,
      nextRun: nextAt(h, m, (d) => d.getDay() >= 1 && d.getDay() <= 5),
      everyMs: DAY_MS,
    };
  }

  for (let i = 0; i < DAYS.length; i++) {
    if (new RegExp(`every\\s+${DAYS[i]}`).test(t)) {
      const h = time?.h ?? 9;
      const m = time?.m ?? 0;
      return {
        cadence: `every ${cap(DAYS[i])} at ${fmt(h, m)}`,
        nextRun: nextAt(h, m, (d) => d.getDay() === i),
        everyMs: WEEK_MS,
      };
    }
  }

  if (/every\s+day|daily/.test(t)) {
    const h = time?.h ?? 8;
    const m = time?.m ?? 0;
    return {
      cadence: `every day at ${fmt(h, m)}`,
      nextRun: nextAt(h, m),
      everyMs: DAY_MS,
    };
  }

  return null;
}

function fmt(h: number, m: number): string {
  const ap = h >= 12 ? "pm" : "am";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hh}${ap}` : `${hh}:${String(m).padStart(2, "0")}${ap}`;
}

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}
