import type { ReactNode } from "react";
import styles from "./workspace.module.css";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <div className={styles.workspace}>{children}</div>;
}
