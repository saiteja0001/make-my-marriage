import styles from "./invitation.module.css";

export default function UnavailableInvitation() {
  return (
    <main className={styles.unavailable}>
      <div className={styles.noticeCard}>
        <h1>Invitation unavailable</h1>
        <p>Ask your hosts for the invitation link.</p>
      </div>
    </main>
  );
}
