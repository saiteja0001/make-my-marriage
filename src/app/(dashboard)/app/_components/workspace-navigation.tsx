"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Wordmark } from "@/components/ui/wordmark";

const links = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/events", label: "Events" },
  { href: "/app/tasks", label: "Tasks" },
];

export function WorkspaceNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  return (
    <aside
      className="border-b border-line bg-white lg:border-r lg:border-b-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <div className="flex min-h-17 items-center justify-between gap-3 px-5 sm:px-8 lg:px-5">
        <Wordmark />
        <button
          ref={menuButton}
          type="button"
          aria-expanded={menuOpen}
          aria-controls="workspace-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
          className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold text-pine lg:hidden"
        >
          {menuOpen ? "Close menu" : "Menu"}
        </button>
      </div>
      <nav
        id="workspace-navigation"
        aria-label="Wedding workspace"
        className={`${menuOpen ? "grid" : "hidden"} gap-1 px-5 pb-4 sm:px-8 lg:grid lg:px-4 lg:pt-5`}
      >
        {links.map(({ href, label }) => {
          const isCurrent = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              aria-current={isCurrent ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
              className={`flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors ${isCurrent ? "bg-sage font-semibold text-pine" : "font-medium text-muted hover:bg-paper hover:text-ink"}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
