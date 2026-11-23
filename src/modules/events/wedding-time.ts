const partsInZone = (timeZone: string) => new Intl.DateTimeFormat("en", {
  timeZone, calendar: "iso8601", numberingSystem: "latn", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});

const offsetsInZone = (timeZone: string) => new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "longOffset" });

function offsetLabel(format: Intl.DateTimeFormat, instant: number) {
  return format.formatToParts(instant).find(({ type }) => type === "timeZoneName")?.value ?? "GMT";
}

export function eventLocalParts(instant: string, timeZone: string) {
  const parts = Object.fromEntries(partsInZone(timeZone).formatToParts(Date.parse(instant))
    .map(({ type, value }) => [type, value]));
  return { date: `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function eventTimeOptions(date: string, time: string, timeZone: string, original?: string) {
  const local = `${date}T${time}`;
  const wallTime = Date.parse(local + "Z");
  if (!Number.isFinite(wallTime) || new Date(wallTime).toISOString().slice(0, 16) !== local) return [];

  const offsetFormat = offsetsInZone(timeZone);
  const day = 86_400_000;
  // Sample both sides of a timezone transition and match each candidate to the entered clock time.
  const candidates = new Set([-day, 0, day].map((shift) => {
    const offset = offsetLabel(offsetFormat, wallTime + shift);
    const match = offset.match(/^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/);
    const seconds = match ? (match[1] === "+" ? 1 : -1) * (+match[2] * 3600 + +match[3] * 60 + +(match[4] ?? 0)) : 0;
    return wallTime - seconds * 1000;
  }));

  const instantsByOffset = new Map<string, string>();
  for (const candidate of candidates) {
    const utc = new Date(candidate).toISOString();
    const parts = eventLocalParts(utc, timeZone);
    if (parts.date === date && parts.time === time) {
      instantsByOffset.set(offsetLabel(offsetFormat, candidate), utc);
    }
  }

  if (original) {
    const saved = eventLocalParts(original, timeZone);
    if (saved.date === date && saved.time === time) {
      // Keep the saved precision when an edit leaves this occurrence unchanged.
      instantsByOffset.set(offsetLabel(offsetFormat, Date.parse(original)), original);
    }
  }

  return Array.from(instantsByOffset, ([offset, instant]) => ({ offset, instant }))
    .sort((a, b) => Date.parse(a.instant) - Date.parse(b.instant));
}

export function formatEventTime(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone, hour: "numeric", minute: "2-digit", hour12: true })
    .format(Date.parse(instant));
}

export function formatEventDay(instant: string, timeZone: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", ...options, timeZone })
    .format(Date.parse(instant));
}

export function formatEventTimeRange(startsAt: string, endsAt: string | undefined, timeZone: string) {
  const start = formatEventTime(startsAt, timeZone);
  if (!endsAt) return start;
  const nextDay = eventLocalParts(startsAt, timeZone).date !== eventLocalParts(endsAt, timeZone).date;
  const end = formatEventTime(endsAt, timeZone);
  const offsetFormat = offsetsInZone(timeZone);
  const startOffset = offsetLabel(offsetFormat, Date.parse(startsAt));
  const endOffset = offsetLabel(offsetFormat, Date.parse(endsAt));
  const day = nextDay ? formatEventDay(endsAt, timeZone) + ", " : "";
  if (startOffset !== endOffset) return `${start} (${startOffset}) – ${day}${end} (${endOffset})`;
  return `${start} – ${day}${end}`;
}

export function weddingTimeZoneLabel(timeZone: string) {
  return timeZone === "Asia/Kolkata" ? "India Standard Time" : timeZone.replaceAll("_", " ");
}
