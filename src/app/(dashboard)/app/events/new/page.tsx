import type { Metadata } from "next";
import { eventDraftContext } from "@/modules/events/service";
import { requireEventWorkspace } from "../_workspace";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "Create wedding event" };

export default async function NewEventPage() {
  const { user, wedding } = await requireEventWorkspace();
  return <EventForm timeZone={wedding.timeZone} context={eventDraftContext(user.id, wedding.id, wedding.timeZone)} />;
}
