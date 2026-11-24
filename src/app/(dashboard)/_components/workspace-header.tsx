import Link from "next/link";
import { BrandMark } from "@/components/ui/wordmark";
import { memberRoleLabels, type MemberRole } from "@/modules/wedding/member-roles";
import styles from "../workspace.module.css";
import { LogoutButton } from "./logout-button";

export function WorkspaceHeader({ member, onRequestLeave, onNavigateAway }: {
  member?: { name: string; role: MemberRole };
  onRequestLeave?: (leave: () => void) => void;
  onNavigateAway?: () => void;
}) {
  return (
    <header className={styles.header}>
      <Link href="/" prefetch={false} className={styles.wordmark} onNavigate={onRequestLeave && ((event) => {
        event.preventDefault();
        onRequestLeave(() => {
          onNavigateAway?.();
          window.location.replace("/");
        });
      })}>
        <BrandMark />
        <span>Make My Marriage</span>
      </Link>
      <div className={styles.headerActions}>
        {member && (
          <p className={styles.headerMember}>
            <strong>{member.name}</strong>{" "}
            <span className={styles.membershipRole}>{memberRoleLabels[member.role]}</span>
          </p>
        )}
        <LogoutButton className={styles.logout} onRequestLeave={onRequestLeave} onLoggedOut={onNavigateAway} />
      </div>
    </header>
  );
}
