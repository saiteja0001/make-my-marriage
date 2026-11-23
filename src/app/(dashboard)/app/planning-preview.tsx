import { demoWedding, formatDemoDate } from "@/app/_data/demo-wedding";
import styles from "./dashboard.module.css";

const { events, tasks, guests } = demoWedding;
const completedTasks = tasks.filter(({ status }) => status === "Completed").length;
const summary = [
  { label: "Events", value: events.length },
  { label: "Tasks completed", value: `${completedTasks} / ${tasks.length}` },
  { label: "Guest groups", value: guests.totalGroups },
  { label: "RSVP responses", value: guests.responseCount },
  { label: "Total expenses", value: "₹1,24,500" },
  { label: "Vendors", value: 8 },
];

export function PlanningPreview() {
  return (
    <>
      <section className={styles.summary} aria-labelledby="planning-summary">
        <div className={styles.sectionHeading}>
          <h2 id="planning-summary">Planning at a glance</h2>
          <span className={styles.sampleLabel}>Sample data</span>
        </div>
        <dl className={styles.metrics}>
          {summary.map(({ label, value }) => (
            <div className={styles.metric} key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className={styles.planningLists}>
        <section className={styles.planningCard} aria-labelledby="upcoming-events">
          <div className={styles.sectionHeading}>
            <h2 id="upcoming-events">Upcoming events</h2>
            <span className={styles.sampleLabel}>Sample data</span>
          </div>
          <ul className={styles.previewList}>
            {events.slice(0, 3).map(({ id, date, name, time, venue }) => (
              <li key={id}>
                <time className={styles.eventDate} dateTime={date}>
                  <span>{formatDemoDate(date, { month: "short" })}</span>
                  <strong>{formatDemoDate(date, { day: "numeric" })}</strong>
                </time>
                <div>
                  <h3>{name}</h3>
                  <p>{time} · {venue}</p>
                </div>
              </li>
            ))}
          </ul>
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
