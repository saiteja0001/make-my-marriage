import Link from "next/link";
import { demoWedding } from "@/app/_data/demo-wedding";
import type { getEventOverview } from "@/modules/events/service";
import { formatEventDay, formatEventTimeRange } from "@/modules/events/wedding-time";
import { taskDueDay } from "@/modules/tasks/due-date";
import type { getTaskOverview } from "@/modules/tasks/service";
import { taskStatuses } from "@/modules/tasks/validation";
import { formatWeddingDate } from "@/modules/wedding/wedding-date";
import { WorkspaceFormLink } from "./_components/workspace-form-link";
import styles from "./dashboard.module.css";

const { guests } = demoWedding;
const sampleMetrics = [
  { label: "Guest groups", value: guests.totalGroups },
  { label: "RSVP responses", value: guests.responseCount },
  { label: "Total expenses", value: "₹1,24,500" },
  { label: "Vendors", value: 8 },
];

export function PlanningPreview({ events, tasks, timeZone }: {
  events: Awaited<ReturnType<typeof getEventOverview>>;
  tasks: Awaited<ReturnType<typeof getTaskOverview>>;
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
          <div className={styles.metric}>
            <dt>Tasks completed</dt>
            <dd>{tasks.completed} / {tasks.total}</dd>
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
              <WorkspaceFormLink href="/app/events/new" className={styles.previewLink}>{events.count ? "Add event" : "Add your first event"}</WorkspaceFormLink>
            </div>
          )}
        </section>
        <section className={styles.planningCard} aria-labelledby="upcoming-tasks">
          <div className={styles.sectionHeading}>
            <h2 id="upcoming-tasks">Upcoming tasks</h2>
            <Link href="/app/tasks" className={styles.previewLink}>View tasks</Link>
          </div>
          {tasks.upcoming.length ? (
            <ul className={styles.previewList}>
              {tasks.upcoming.map(({ id, dueDate, title, status }) => {
                const date = taskDueDay(dueDate, timeZone);
                return (
                  <li key={id} className={styles.task}>
                    <div>
                      <h3><Link href={`/app/tasks/${id}`}>{title}</Link></h3>
                      <p>Due <time dateTime={date}>{formatWeddingDate(date)}</time></p>
                    </div>
                    <span className={styles.taskStatus}>{taskStatuses[status]}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.emptyPreview}>
              <p>No upcoming tasks.</p>
              <WorkspaceFormLink href="/app/tasks/new" className={styles.previewLink}>{tasks.total ? "Add task" : "Add your first task"}</WorkspaceFormLink>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
