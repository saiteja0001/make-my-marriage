"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import styles from "./workspace-shell.module.css";

export type WorkspacePath = "/app" | "/app/edit" | "/app/members" | "/app/events" | "/app/tasks" | "/app/guests" | "/app/guests/rsvps" | "/app/photos" | "/app/expenses" | "/app/vendors" | "/app/vendors/discover";

type Destination = {
  label: string;
  href?: WorkspacePath;
  items?: readonly string[];
};

const documentNavigationPaths: readonly WorkspacePath[] = ["/app/edit", "/app/expenses", "/app/vendors", "/app/vendors/discover"];

const navigation: readonly { label: string; destinations: readonly Destination[] }[] = [
  {
    label: "Workspace",
    destinations: [{ label: "Dashboard", href: "/app" }],
  },
  {
    label: "Planning",
    destinations: [
      { label: "Events", href: "/app/events" },
      { label: "Tasks", href: "/app/tasks" },
    ],
  },
  {
    label: "Guests",
    destinations: [
      { label: "Guest List", href: "/app/guests" },
      { label: "RSVP Summary", href: "/app/guests/rsvps" },
      { label: "Invitation delivery" },
    ],
  },
  {
    label: "Expenses & vendors",
    destinations: [
      { label: "Expenses", href: "/app/expenses" },
      { label: "My Vendors", href: "/app/vendors" },
      { label: "Discover Vendors", href: "/app/vendors/discover" },
    ],
  },
  {
    label: "Wedding experience",
    destinations: [
      { label: "Wedding Website", items: ["Themes"] },
      { label: "Live Stream" },
    ],
  },
  {
    label: "Photos",
    destinations: [
      { label: "Gallery", href: "/app/photos" },
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const selectedPath = navigation.some(({ destinations }) => destinations.some(({ href }) => href === pathname)) ? pathname : currentPath;

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

                const current = selectedPath === href;
                const samePage = current && pathname === href && !searchParams?.toString();
                const needsDocumentNavigation = documentNavigationPaths.includes(href)
                  && (!current || (href === "/app/vendors" && !samePage));
                return (
                  <li key={label}>
                    {/* Enter these forms with a full navigation so browser Back uses beforeunload. */}
                    {needsDocumentNavigation && !onRequestLeave ? (
                      <a className={styles.navRow} href={href} aria-current={current ? "location" : undefined}>{label}</a>
                    ) : (
                      <Link
                        href={href}
                        className={styles.navRow}
                        aria-current={current ? (samePage ? "page" : "location") : undefined}
                        onNavigate={(event) => {
                          if (samePage) {
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
