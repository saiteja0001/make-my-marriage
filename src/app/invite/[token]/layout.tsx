import type { Metadata } from "next";
import type { ReactNode } from "react";
import styles from "../../(dashboard)/workspace.module.css";

export const metadata: Metadata = {
  title: "Wedding invitation",
  description: "View your wedding invitation and respond.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function InviteLayout({ children }: { children: ReactNode }) {
  return <div className={styles.workspace}>{children}</div>;
}
