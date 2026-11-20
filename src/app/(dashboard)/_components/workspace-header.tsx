import Link from "next/link";
import styles from "../workspace.module.css";
import { LogoutButton } from "./logout-button";

const roleLabels = { ADMIN: "Admin", MANAGER: "Manager" };

export function WorkspaceHeader({ member, onRequestLeave, onNavigateAway }: {
  member?: { name: string; role: keyof typeof roleLabels };
  onRequestLeave?: (leave: () => void) => void;
  onNavigateAway?: () => void;
}) {
  return (
    <header className={styles.header}>
      <Link href="/app" className={styles.wordmark} onNavigate={onRequestLeave && ((event) => {
        event.preventDefault();
        onRequestLeave(() => {
          onNavigateAway?.();
          window.location.replace("/app");
        });
      })}>
        Make My Marriage<span aria-hidden="true">.</span>
      </Link>
      <div className={styles.headerActions}>
        {member && (
          <p className={styles.headerMember}>
            <strong>{member.name}</strong>{" "}
            <span className={styles.membershipRole}>{roleLabels[member.role]}</span>
          </p>
        )}
        <LogoutButton className={styles.logout} onRequestLeave={onRequestLeave} onLoggedOut={onNavigateAway} />
      </div>
    </header>
  );
}
