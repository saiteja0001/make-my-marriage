import type { ReactNode } from "react";
import { WorkspaceShell } from "../_components/workspace-shell";
import { requireEventWorkspace } from "./_workspace";
import styles from "./events.module.css";

export default async function EventsLayout({ children }: { children: ReactNode }) {
  const { user, membership } = await requireEventWorkspace();
  return (
    <WorkspaceShell currentPath="/app/events" member={{ name: user.name, role: membership.role }}>
      <main className={styles.page}>{children}</main>
    </WorkspaceShell>
  );
}
