const grouping = new Intl.NumberFormat("en-IN");

export function formatInr(paise: number) {
  const remainder = paise % 100;
  return "₹" + grouping.format(Math.floor(paise / 100)) + (remainder ? "." + String(remainder).padStart(2, "0") : "");
}

export function inrInput(paise: number) {
  return String(Math.floor(paise / 100)) + "." + String(paise % 100).padStart(2, "0");
}

export function parseInr(input: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}
