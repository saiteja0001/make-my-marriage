import type { ReactNode } from "react";
import { WorkspaceDraftShell } from "../_components/workspace-draft";
import { requireGuestWorkspace } from "./_workspace";
import styles from "./guests.module.css";

export default async function GuestsLayout({ children }: { children: ReactNode }) {
  const { user, membership } = await requireGuestWorkspace();
  return (
    <WorkspaceDraftShell currentPath="/app/guests" member={{ name: user.name, role: membership.role }}>
      <main className={styles.page}>{children}</main>
    </WorkspaceDraftShell>
  );
}
