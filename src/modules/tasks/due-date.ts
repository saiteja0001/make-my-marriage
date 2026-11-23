import { eventTimeOptions } from "@/modules/events/wedding-time";
import { weddingLocalDate } from "@/modules/wedding/wedding-date";
import type { TaskStatus } from "./validation";

const day = 86_400_000;

export function taskDayStart(date: string, timeZone: string) {
  const wallTime = Date.parse(date + "T00:00:00Z");
  if (!Number.isFinite(wallTime) || new Date(wallTime).toISOString().slice(0, 10) !== date) return null;

  const midnight = eventTimeOptions(date, "00:00", timeZone)[0]?.instant;
  if (midnight) return midnight;

  // A forward clock change can skip midnight or the entire local date.
  let before = wallTime - day;
  let after = wallTime + day;
  while (after - before > 1) {
    const midpoint = Math.floor((before + after) / 2);
    if (weddingLocalDate(midpoint, timeZone) < date) before = midpoint;
    else after = midpoint;
  }
  return weddingLocalDate(after, timeZone) === date ? new Date(after).toISOString() : null;
}

export function taskDueDay(dueDate: string, timeZone: string) {
  return weddingLocalDate(Date.parse(dueDate), timeZone);
}

export function taskDueState(status: TaskStatus, dueDay: string, today: string) {
  if (status === "COMPLETED") return null;
  if (dueDay < today) return "overdue";
  if (dueDay === today) return "today";
  return null;
}
