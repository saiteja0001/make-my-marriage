import Link from "next/link";
import styles from "../workspace.module.css";
import { LogoutButton } from "./logout-button";

const roleLabels = { ADMIN: "Admin", MANAGER: "Manager" };

export function WorkspaceHeader({ member }: { member?: { name: string; role: keyof typeof roleLabels } }) {
  return (
    <header className={styles.header}>
      <Link href="/app" className={styles.wordmark}>
        Make My Marriage<span aria-hidden="true">.</span>
      </Link>
      <div className={styles.headerActions}>
        {member && (
          <p className={styles.headerMember}>
            <strong>{member.name}</strong>{" "}
            <span className={styles.membershipRole}>{roleLabels[member.role]}</span>
          </p>
        )}
        <LogoutButton className={styles.logout} />
      </div>
    </header>
  );
}
