import Link from "next/link";
import { demoWedding, formatDemoDate } from "@/app/_data/demo-wedding";
import type { getEventOverview } from "@/modules/events/service";
import { formatEventDay, formatEventTimeRange } from "@/modules/events/wedding-time";
import styles from "./dashboard.module.css";

const { tasks, guests } = demoWedding;
const completedTasks = tasks.filter(({ status }) => status === "Completed").length;
const sampleMetrics = [
  { label: "Tasks completed", value: `${completedTasks} / ${tasks.length}` },
  { label: "Guest groups", value: guests.totalGroups },
  { label: "RSVP responses", value: guests.responseCount },
  { label: "Total expenses", value: "₹1,24,500" },
  { label: "Vendors", value: 8 },
];

export function PlanningPreview({ events, timeZone }: {
  events: Awaited<ReturnType<typeof getEventOverview>>;
  timeZone: string;
}) {
  return (
    <>
      <section className={styles.summary} aria-labelledby="planning-summary">
        <div className={styles.sectionHeading}>
          <h2 id="planning-summary">Planning at a glance</h2>
        </div>
        <dl className={styles.metrics}>
          <div className={styles.metric}>
            <dt>Events</dt>
            <dd>{events.count}</dd>
          </div>
          {sampleMetrics.map(({ label, value }) => (
            <div className={styles.metric} key={label}>
              <dt>{label}</dt>
              <dd>{value}<span className={styles.metricSample}>Sample data</span></dd>
            </div>
          ))}
        </dl>
      </section>
      <div className={styles.planningLists}>
        <section className={styles.planningCard} aria-labelledby="upcoming-events">
          <div className={styles.sectionHeading}>
            <h2 id="upcoming-events">Upcoming events</h2>
            <Link href="/app/events" className={styles.previewLink}>View events</Link>
          </div>
          {events.upcoming.length ? (
            <ul className={styles.previewList}>
              {events.upcoming.map(({ id, startsAt, endsAt, name, venueName }) => (
                <li key={id}>
                  <time className={styles.eventDate} dateTime={startsAt}>
                    <span>{formatEventDay(startsAt, timeZone, { day: undefined })}</span>
                    <strong>{formatEventDay(startsAt, timeZone, { month: undefined })}</strong>
                  </time>
                  <div>
                    <h3><Link href={`/app/events/${id}`}>{name}</Link></h3>
                    <p>{formatEventTimeRange(startsAt, endsAt, timeZone)}{venueName && ` · ${venueName}`}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.emptyPreview}>
              <p>No upcoming events.</p>
              <Link href="/app/events/new" className={styles.previewLink}>{events.count ? "Add event" : "Add your first event"}</Link>
            </div>
          )}
        </section>
        <section className={styles.planningCard} aria-labelledby="upcoming-tasks">
          <div className={styles.sectionHeading}>
            <h2 id="upcoming-tasks">Upcoming tasks</h2>
            <span className={styles.sampleLabel}>Sample data</span>
          </div>
          <ul className={styles.previewList}>
            {tasks.filter(({ status }) => status !== "Completed").slice(0, 3).map(({ id, dueDate, name, status }) => (
              <li key={id} className={styles.task}>
                <div>
                  <h3>{name}</h3>
                  <p>Due <time dateTime={dueDate}>{formatDemoDate(dueDate, { day: "numeric", month: "short" })}</time></p>
                </div>
                <span className={styles.taskStatus}>{status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
