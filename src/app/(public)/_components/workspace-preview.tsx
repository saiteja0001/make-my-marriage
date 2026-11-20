import Link from "next/link";
import { demoWedding, formatDemoDate } from "@/app/_data/demo-wedding";
import { sampleGuestResponses } from "../_data/landing-content";
import styles from "../homepage.module.css";

const workspaceLinks = [
  { href: "/demo", label: "Overview" },
  { href: "/demo/events", label: "Wedding events" },
  { href: "/demo/tasks", label: "Family tasks" },
];

export function WorkspacePreview() {
  const { couple, location, events, tasks, guests } = demoWedding;
  const completed = tasks.filter((task) => task.status === "Completed").length;
  const totals = [
    { label: "Wedding events", value: events.length },
    { label: "Tasks completed", value: completed + " of " + tasks.length },
    { label: "Guest groups", value: guests.totalGroups },
    { label: "RSVP responses", value: guests.responseCount },
  ];

  return (
    <section aria-label="Sample planning workspace" className={styles.workspace}>
      <div className={styles.previewBar}>
        <span className={styles.windowDots} aria-hidden="true">
          <span /><span /><span />
        </span>
        <span>Planning workspace</span>
        <span className={styles.previewLabel}>Sample data</span>
      </div>
      <div className={styles.previewBody}>
        <aside className={styles.previewSidebar}>
          <div className={styles.previewIdentity}>
            <span className={styles.coupleMark} aria-hidden="true">P&amp;A</span>
            <div>
              <strong>{couple}</strong>
              <span>{location}</span>
            </div>
          </div>
          <nav aria-label="Demo workspace" className={styles.previewNav}>
            {workspaceLinks.map(({ href, label }) => (
              <Link key={href} href={href}>{label}</Link>
            ))}
          </nav>
          <Link href="#wedding-preview" className={styles.previewGuestLink}>
            Preview the wedding website
          </Link>
        </aside>

        <div className={styles.previewContent}>
          <dl className={styles.previewTotals}>
            {totals.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className={styles.previewPanels}>
            <section className={styles.previewPanel}>
              <h2>Wedding schedule</h2>
              <ul className={styles.timeline}>
                {events.map((event) => (
                  <li key={event.id}>
                    <time dateTime={event.date}>
                      <strong>{formatDemoDate(event.date, { day: "numeric" })}</strong>
                      <span>{formatDemoDate(event.date, { month: "short" })}</span>
                    </time>
                    <div>
                      <strong>{event.name}</strong>
                      <p>{event.time} · {event.venue}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <section className={styles.previewPanel}>
              <h2>Guest responses</h2>
              <ul className={styles.responseList}>
                {sampleGuestResponses.map(({ group, guests, status }) => (
                  <li key={group}>
                    <p><strong>{group}</strong> <span>· {guests} guests invited</span></p>
                    <span className={status === "Attending" ? styles.attending : styles.waiting}>
                      {status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
