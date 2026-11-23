import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getEventOverview } from "@/modules/events/service";
import { taskDayStart } from "@/modules/tasks/due-date";
import { getTaskOverview } from "@/modules/tasks/service";
import { getWeddingForUser } from "@/modules/wedding/service";
import { daysUntilWedding, formatWeddingDate, weddingLocalDate } from "@/modules/wedding/wedding-date";
import { getSignedInUser } from "@/server/auth/session";
import { WorkspaceShell } from "./_components/workspace-shell";
import { PlanningPreview } from "./planning-preview";
import { WeddingCountdown } from "./wedding-countdown";
import { WeddingUpdated } from "./wedding-updated";
import styles from "./dashboard.module.css";

export const metadata: Metadata = { title: "Wedding dashboard" };

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const current = await getWeddingForUser(user.id);
  if (!current) redirect("/onboarding");

  const { membership, wedding } = current;
  const now = new Date();
  const dayStart = taskDayStart(weddingLocalDate(now, wedding.timeZone), wedding.timeZone);
  const [events, tasks] = await Promise.all([
    getEventOverview(wedding.id, now),
    getTaskOverview(wedding.id, dayStart ? new Date(dayStart) : now),
  ]);
  const couple = `${wedding.brideName} & ${wedding.groomName}`;
  return (
    <WorkspaceShell currentPath="/app" member={{ name: user.name, role: membership.role }}>
      <main className={styles.overview}>
        {(await searchParams).updated === "1" && <WeddingUpdated />}
        <section className={styles.hero} aria-labelledby="wedding-heading">
          <div className={styles.heroDetails}>
            <h1 id="wedding-heading">{wedding.title || couple}</h1>
            {wedding.title && <p className={styles.couple}>{couple}</p>}
            <dl className={styles.details}>
              <div>
                <dt>Wedding date</dt>
                <dd><time dateTime={wedding.weddingDate}>{formatWeddingDate(wedding.weddingDate)}</time></dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{wedding.location.formattedAddress}</dd>
              </div>
            </dl>
            {wedding.description && <p className={styles.description}>{wedding.description}</p>}
            <div className={styles.actions}>
              {/* A full navigation lets browser Back use the edit page's beforeunload guard. */}
              <a className={styles.primaryAction} href="/app/edit">Edit wedding</a>
              <Link className={styles.secondaryAction} href="/app/members">Wedding members</Link>
            </div>
          </div>
          <div className={styles.countdownPanel}>
            <Image
              src="/wedding-hero.jpg"
              alt=""
              fill
              sizes="(min-width: 64rem) min(calc(40vw - 6.8rem), 38rem), (min-width: 41rem) 40vw, 94vw"
              className={styles.heroImage}
            />
            <WeddingCountdown
              weddingDate={wedding.weddingDate}
              timeZone={wedding.timeZone}
              initialDays={daysUntilWedding(wedding.weddingDate, wedding.timeZone)}
            />
            <p className={styles.timeZone}>{wedding.timeZone}</p>
          </div>
        </section>
        <PlanningPreview events={events} tasks={tasks} timeZone={wedding.timeZone} />
      </main>
    </WorkspaceShell>
  );
}
