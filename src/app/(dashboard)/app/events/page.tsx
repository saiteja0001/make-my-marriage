import type { Metadata } from "next";
import { EventList } from "../_components/wedding-lists";
import { demoWedding } from "@/app/_data/demo-wedding";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-tight text-pine sm:text-5xl">Events</h1>
      <section aria-labelledby="wedding-schedule" className="panel max-w-3xl">
        <h2 id="wedding-schedule" className="border-b border-line px-4 py-4 font-display text-2xl text-pine sm:px-5">
          Wedding schedule
        </h2>
        <EventList events={demoWedding.events} />
      </section>
    </div>
  );
}
