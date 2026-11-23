import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eventDraftContext } from "@/modules/events/service";
import { requireWorkspaceEvent } from "../../_workspace";
import { EventForm } from "../../event-form";

export const metadata: Metadata = { title: "Edit wedding event" };

export default async function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { event, user, wedding } = await requireWorkspaceEvent((await params).eventId);
  if (event.archivedAt) redirect(`/app/events/${event.id}`);
  return (
    <EventForm
      key={event.id}
      event={event}
      timeZone={wedding.timeZone}
      context={eventDraftContext(user.id, wedding.id, wedding.timeZone)}
    />
  );
}
