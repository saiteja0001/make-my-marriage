import { defaultWeddingTimeZone } from "./validation";

const supportedTimeZones = [
  defaultWeddingTimeZone,
  "UTC",
  ...Intl.supportedValuesOf("timeZone").filter(
    (zone) => zone !== defaultWeddingTimeZone && zone !== "Asia/Calcutta",
  ),
];

export function weddingTimeZones(current?: string) {
  return current && !supportedTimeZones.includes(current) ? [current, ...supportedTimeZones] : supportedTimeZones;
}
