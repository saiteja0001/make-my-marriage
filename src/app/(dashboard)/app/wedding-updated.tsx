"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";

export function WeddingUpdated() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const location = new URL(window.location.href);
    location.searchParams.delete("updated");
    window.history.replaceState(window.history.state, "", location);
    const timeout = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timeout);
  }, []);

  return visible ? <p className={styles.updated} role="status">Wedding details updated</p> : null;
}
