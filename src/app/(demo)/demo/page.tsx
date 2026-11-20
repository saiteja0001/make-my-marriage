import type { Metadata } from "next";
import Link from "next/link";
import { EventList, TaskList } from "./_components/wedding-lists";
import { demoWedding, formatDemoDate } from "@/app/_data/demo-wedding";

export const metadata: Metadata = { title: "Dashboard" };

const daysToGo =
  (Date.parse(demoWedding.date) - Date.parse(demoWedding.asOfDate)) / 86_400_000;
const completedTasks = demoWedding.tasks.filter((task) => task.status === "Completed");
const upcomingTasks = demoWedding.tasks.filter(
  (task) => task.status !== "Completed" && task.dueDate >= demoWedding.asOfDate,
);
const upcomingEvents = demoWedding.events.filter(
  (event) => event.date >= demoWedding.asOfDate,
);
const stats = [
  { label: "Wedding events", value: demoWedding.events.length },
  { label: "Tasks completed", value: `${completedTasks.length} of ${demoWedding.tasks.length}` },
  { label: "Guest groups", value: demoWedding.guests.totalGroups },
  { label: "RSVP responses", value: demoWedding.guests.responseCount },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-tight text-pine sm:text-5xl">Dashboard</h1>
      <section
        aria-label="Wedding overview"
        className="grid items-center gap-5 rounded-2xl bg-pine p-5 text-white sm:grid-cols-[1fr_auto] sm:px-8 sm:py-7"
      >
        <div>
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">{demoWedding.couple}</h2>
          <p className="mt-2 text-base text-white/85">
            <time dateTime={demoWedding.date}>
              {formatDemoDate(demoWedding.date, { day: "numeric", month: "long", year: "numeric" })}
            </time>
            {" · "}{demoWedding.location}
          </p>
        </div>
        <div className="w-fit rounded-xl bg-white/10 px-4 py-2.5 sm:min-w-28 sm:text-center">
          <p className="font-display text-3xl leading-none">{daysToGo}</p>
          <p className="mt-1 text-sm text-white/85">days to go</p>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="panel p-3.5 sm:p-5">
            <dt className="text-sm font-medium text-muted">{label}</dt>
            <dd className="mt-1.5 font-display text-3xl tracking-tight text-pine">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <section aria-labelledby="upcoming-events" className="panel">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-4 sm:px-5">
            <h2 id="upcoming-events" className="font-display text-2xl tracking-tight text-pine">
              Upcoming events
            </h2>
            <Link href="/demo/events" className="rounded-sm text-sm font-semibold text-clay hover:underline">
              All events
            </Link>
          </div>
          <EventList events={upcomingEvents.slice(0, 3)} />
        </section>
        <section aria-labelledby="upcoming-tasks" className="panel">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-4 sm:px-5">
            <h2 id="upcoming-tasks" className="font-display text-2xl tracking-tight text-pine">
              Upcoming tasks
            </h2>
            <Link href="/demo/tasks" className="rounded-sm text-sm font-semibold text-clay hover:underline">
              All tasks
            </Link>
          </div>
          <TaskList tasks={upcomingTasks.slice(0, 3)} />
        </section>
      </div>
    </div>
  );
}
