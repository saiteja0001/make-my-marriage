import Image from "next/image";
import { demoWedding, formatDemoDate } from "@/app/_data/demo-wedding";
import { eventPhotos } from "../_data/landing-content";
import styles from "../homepage.module.css";

export function WeddingPreview() {
  const { couple, date, location, events } = demoWedding;

  return (
    <section id="wedding-preview" className={styles.section} aria-labelledby="wedding-preview-title">
      <div className={styles.shell}>
        <div className={styles.previewHeading}>
          <h2 id="wedding-preview-title">A wedding website for your guests</h2>
          <p>See how a sample wedding can share its details and ceremonies in one place.</p>
        </div>
        <article className={styles.weddingCard} aria-labelledby="sample-couple">
          <div className={styles.weddingCover}>
            <div className={styles.weddingIntro}>
              <p className={styles.weddingEyebrow}>Sample wedding website</p>
              <h3 id="sample-couple">{couple}</h3>
              <p className={styles.weddingDate}>
                <time dateTime={date}>
                  {formatDemoDate(date, { day: "numeric", month: "long", year: "numeric" })}
                </time>
                <span>{location}</span>
              </p>
              <a className={styles.outlinedAction} href="#sample-schedule">View ceremony schedule</a>
            </div>
            <div className={styles.weddingPhoto}>
              <Image
                src="/wedding-hero.jpg"
                alt="A bride and groom smiling beneath a marigold-draped arch"
                fill
                sizes="(max-width: 740px) 94vw, (max-width: 92rem) 45vw, 41rem"
              />
            </div>
          </div>

          <div id="sample-schedule" className={styles.weddingEvents}>
            <h4>Wedding events</h4>
            <ul>
              {events.map((event) => {
                const photo = eventPhotos[event.id];
                return (
                  <li key={event.id} className={styles.eventCard}>
                    <div className={styles.eventPhoto}>
                      {photo && (
                        <Image
                          src={photo.src}
                          alt={photo.alt}
                          fill
                          sizes="(max-width: 440px) 85vw, (max-width: 960px) 45vw, (max-width: 92rem) 22vw, 20rem"
                        />
                      )}
                      <time dateTime={event.date}>
                        {formatDemoDate(event.date, { day: "numeric", month: "short" })}
                      </time>
                    </div>
                    <div className={styles.eventDetails}>
                      <strong>{event.name}</strong>
                      <p>{event.time} · {event.venue}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}
