import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui/wordmark";
import styles from "./account.module.css";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.layout}>
      <div className={styles.visual}>
        <Image src="/wedding-hero.jpg" alt="" fill sizes="(max-width: 47.99rem) 100vw, 52vw" preload />
        <p>Plan the celebration<br />together.</p>
      </div>
      <div className={styles.content}>
        <header className={styles.header}>
          <Wordmark />
          <nav aria-label="Account navigation"><Link href="/" className={styles.homeLink}>Back to home</Link></nav>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
