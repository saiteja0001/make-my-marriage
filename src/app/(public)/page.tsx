import Link from "next/link";
import { demoWedding } from "@/app/_data/demo-wedding";
import { WeddingPreview } from "./_components/wedding-preview";
import { WorkspacePreview } from "./_components/workspace-preview";
import { sampleExpenses, sampleMetrics } from "./_data/landing-content";
import styles from "./homepage.module.css";

const sections = [
  { href: "#features", label: "Features" },
  { href: "#family-and-guests", label: "Family & guests" },
  { href: "#wedding-preview", label: "Wedding preview" },
];

export default function HomePage() {
  const nextTask = demoWedding.tasks[0];

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#homepage-content">Skip to content</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">♡</span>
            <span>Make My Marriage</span>
          </Link>

          <nav className={styles.sectionNav} aria-label="Homepage sections">
            {sections.map(({ href, label }) => <a key={href} href={href}>{label}</a>)}
          </nav>

          <nav className={styles.accountNav} aria-label="Account">
            <Link href="/login">Log in</Link>
            <Link href="/signup" className={styles.primaryAction}>Sign up</Link>
          </nav>
        </div>
      </header>

      <main id="homepage-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="homepage-title">
          <div className={styles.shell}>
            <p className={styles.eyebrow}>Indian wedding planning</p>
            <h1 id="homepage-title">Your wedding. One shared <em>workspace.</em></h1>
            <p className={styles.heroDescription}>
              Explore a sample wedding schedule, family checklist, and website for guests.
            </p>
            <div className={styles.actions}>
              <Link href="/app" className={styles.primaryAction}>Explore the demo</Link>
              <a href="#wedding-preview" className={styles.outlinedAction}>Preview a wedding website</a>
            </div>
            <WorkspacePreview />
          </div>
        </section>

        <section className={styles.metricStrip} aria-labelledby="metrics-title">
          <div className={styles.shell}>
            <h2 id="metrics-title" className={styles.eyebrow}>Sample metrics</h2>
            <dl className={styles.metrics}>
              {sampleMetrics.map(({ label, value }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="features" className={styles.section} aria-labelledby="features-title">
          <div className={styles.shell}>
            <div className={styles.sectionHeading}>
              <h2 id="features-title">A shared plan for every ceremony</h2>
              <p>See how a wedding schedule and family checklist fit together.</p>
            </div>
            <div className={styles.featureGrid}>
              <article className={styles.featureCard}>
                <span aria-hidden="true" className={styles.featureMark}>▦</span>
                <h3>Plan multiple events</h3>
                <p>See the time and venue for each event, from Mehendi to the wedding ceremony.</p>
                <dl className={styles.exampleRows}>
                  {demoWedding.events.slice(0, 3).map((event) => (
                    <div key={event.id}><dt>{event.name}</dt><dd>{event.time}</dd></div>
                  ))}
                </dl>
              </article>
              <article className={styles.featureCard}>
                <span aria-hidden="true" className={styles.featureMark}>✓</span>
                <h3>Coordinate family tasks</h3>
                <p>See who owns each task and where it stands in the family checklist.</p>
                <div className={styles.exampleTask}>
                  <strong>{nextTask.name}</strong>
                  <p>{nextTask.assignee} · {nextTask.status}</p>
                </div>
              </article>
              <article className={styles.featureCard}>
                <span aria-hidden="true" className={styles.featureMark}>₹</span>
                <h3>Track wedding expenses</h3>
                <p>Expense tracking is planned. These sample expenses show what it could look like.</p>
                <dl className={styles.exampleRows}>
                  {sampleExpenses.map(({ label, amount }) => (
                    <div key={label}><dt>{label}</dt><dd>{amount}</dd></div>
                  ))}
                </dl>
              </article>
            </div>
            <div className={styles.invitationCallout}>
              <div>
                <h3>Invitations that guests can open in a browser</h3>
                <p>Planned invitation links will let guests see their events and RSVP for their group.</p>
              </div>
              <a href="#wedding-preview" className={styles.outlinedAction}>Preview the wedding website</a>
            </div>
          </div>
        </section>

        <section id="family-and-guests" className={styles.tintedSection} aria-labelledby="audiences-title">
          <div className={styles.shell}>
            <div className={styles.sectionHeading}>
              <h2 id="audiences-title">One wedding, two ways to take part</h2>
              <p>Explore the planning workspace and see what guests would find on the wedding website.</p>
            </div>
            <div className={styles.audienceGrid}>
              <article className={styles.audienceCard}>
                <p className={styles.eyebrow}>For the couple and family</p>
                <h3>Planning workspace preview</h3>
                <ul>
                  <li>Browse the sample schedule and family checklist.</li>
                  <li>See example guest responses.</li>
                  <li>Guest list management, expense tracking, and saved vendor details are planned.</li>
                </ul>
              </article>
              <article className={styles.audienceCard}>
                <p className={styles.eyebrow}>For invited guests</p>
                <h3>Wedding website preview</h3>
                <ul>
                  <li>Find ceremony times and venues on the sample website.</li>
                  <li>Invitation links and account-free RSVPs are planned.</li>
                  <li>A shared gallery for viewing and contributing photos is planned.</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <WeddingPreview />

        <section className={styles.closing} aria-labelledby="closing-title">
          <div className={styles.shell}>
            <h2 id="closing-title">Bring your families into one plan</h2>
            <p>Explore a sample wedding to see how the workspace fits together.</p>
            <div className={styles.actions}>
              <Link href="/app" className={styles.goldAction}>Explore the demo</Link>
              <Link href="/signup" className={styles.lightAction}>Sign up</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.shell}>
          <Link href="/" className={styles.footerBrand}>Make My Marriage</Link>
          <nav aria-label="Footer">
            <a href="#features">Features</a>
            <a href="#wedding-preview">Wedding preview</a>
            <Link href="/login">Log in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
