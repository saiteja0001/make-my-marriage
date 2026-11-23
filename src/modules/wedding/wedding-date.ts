const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function formatWeddingDate(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "UTC" }).format(day);
}

export function weddingLocalDate(instant: Date | number, timeZone: string) {
  const dateParts = new Intl.DateTimeFormat("en", {
    timeZone,
    calendar: "iso8601",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const { year, month, day } = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
  return `${year.padStart(4, "0")}-${month}-${day}`;
}

export function daysUntilWedding(weddingDate: string, timeZone: string, now = new Date()) {
  // Compare calendar dates on a uniform scale, including across daylight saving changes.
  return (Date.parse(weddingDate) - Date.parse(weddingLocalDate(now, timeZone))) / millisecondsPerDay;
}
