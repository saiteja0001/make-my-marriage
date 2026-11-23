import type { ReactNode } from "react";
import { WorkspaceDraftShell } from "../_components/workspace-draft";
import { requireTaskWorkspace } from "./_workspace";
import styles from "./tasks.module.css";

export default async function TasksLayout({ children }: { children: ReactNode }) {
  const { user, membership } = await requireTaskWorkspace();
  return (
    <WorkspaceDraftShell currentPath="/app/tasks" member={{ name: user.name, role: membership.role }}>
      <main className={styles.page}>{children}</main>
    </WorkspaceDraftShell>
  );
}
