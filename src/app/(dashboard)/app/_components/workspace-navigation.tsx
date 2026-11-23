"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import styles from "./workspace-shell.module.css";

export type WorkspacePath = "/app" | "/app/edit" | "/app/members";

type Destination = {
  label: string;
  href?: WorkspacePath;
  items?: readonly string[];
};

const navigation: readonly { label: string; destinations: readonly Destination[] }[] = [
  {
    label: "Workspace",
    destinations: [{ label: "Dashboard", href: "/app" }],
  },
  {
    label: "Planning",
    destinations: [
      { label: "Events" },
      { label: "Tasks" },
      { label: "Guests", items: ["Guest List", "Invitations", "RSVPs"] },
    ],
  },
  {
    label: "Expenses & vendors",
    destinations: [
      { label: "Expenses" },
      { label: "Vendors", items: ["My Vendors", "Discover Vendors"] },
    ],
  },
  {
    label: "Wedding experience",
    destinations: [
      { label: "Wedding Website", items: ["Themes"] },
      { label: "Photos", items: ["Gallery", "Guest Upload", "QR Code"] },
      { label: "Live Stream" },
    ],
  },
  {
    label: "Settings",
    destinations: [
      { label: "Wedding Details", href: "/app/edit" },
      { label: "Wedding Members", href: "/app/members" },
    ],
  },
];

export function WorkspaceNavigation({ currentPath, onRequestLeave, onNavigateAway }: {
  currentPath: WorkspacePath;
  onRequestLeave?: (leave: () => void) => void;
  onNavigateAway?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  function closeMenuAndRestoreFocus() {
    setMenuOpen(false);
    const button = menuButton.current;
    if (button?.getClientRects().length) button.focus();
  }

  return (
    <div className={styles.sidebar} onKeyDown={(event) => {
      if (event.key === "Escape" && menuOpen) closeMenuAndRestoreFocus();
    }}>
      <button
        type="button"
        ref={menuButton}
        className={styles.menuButton}
        aria-expanded={menuOpen}
        aria-controls="private-workspace-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span>{menuOpen ? "Close workspace menu" : "Workspace menu"}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      <nav
        className={styles.navigation}
        id="private-workspace-navigation"
        data-open={menuOpen}
        aria-label="Wedding workspace"
      >
        {navigation.map(({ label, destinations }) => (
          <div className={styles.navGroup} key={label}>
            <p className={styles.groupLabel}>{label}</p>
            <ul aria-label={label}>
              {destinations.map(({ label, href, items }) => {
                if (!href) return (
                  <li key={label}>
                    {items ? (
                      <details className={styles.plannedGroup}>
                        <summary className={styles.navRow}>
                          <span>{label}</span>
                          <span className={styles.plannedActions}>
                            <span className={styles.planned}>Planned</span>
                            <span className={styles.chevron} aria-hidden="true" />
                          </span>
                        </summary>
                        <ul className={styles.plannedItems} aria-label={label}>
                          {items.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </details>
                    ) : (
                      <span className={styles.navRow}>{label}<span className={styles.planned}>Planned</span></span>
                    )}
                  </li>
                );

                const current = currentPath === href;
                return (
                  <li key={label}>
                    {/* Enter the edit page with a full navigation so browser Back uses beforeunload. */}
                    {href === "/app/edit" && !current ? (
                      <a className={styles.navRow} href={href}>{label}</a>
                    ) : (
                      <Link
                        href={href}
                        className={styles.navRow}
                        aria-current={current ? "page" : undefined}
                        onNavigate={(event) => {
                          if (current) {
                            event.preventDefault();
                            closeMenuAndRestoreFocus();
                            return;
                          }
                          if (onRequestLeave) {
                            event.preventDefault();
                            onRequestLeave(() => {
                              onNavigateAway?.();
                              window.location.assign(href);
                            });
                            return;
                          }
                          setMenuOpen(false);
                        }}
                      >
                        {label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
