import type { ReactNode } from "react";
import type { MemberRole } from "@/modules/wedding/member-roles";
import { WorkspaceHeader } from "../../_components/workspace-header";
import { WorkspaceNavigation, type WorkspacePath } from "./workspace-navigation";
import styles from "./workspace-shell.module.css";

export function WorkspaceShell({ children, member, currentPath, onRequestLeave, onNavigateAway }: {
  children: ReactNode;
  member: { name: string; role: MemberRole };
  currentPath: WorkspacePath;
  onRequestLeave?: (leave: () => void) => void;
  onNavigateAway?: () => void;
}) {
  return (
    <>
      <a href="#workspace-content" className={styles.skipLink}>Skip to content</a>
      <WorkspaceHeader member={member} onRequestLeave={onRequestLeave} onNavigateAway={onNavigateAway} />
      <div className={styles.layout}>
        <WorkspaceNavigation
          currentPath={currentPath}
          onRequestLeave={onRequestLeave}
          onNavigateAway={onNavigateAway}
        />
        <div className={styles.content} id="workspace-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </>
  );
}
