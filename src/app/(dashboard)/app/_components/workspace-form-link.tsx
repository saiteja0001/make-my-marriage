"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

export function WorkspaceFormLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: string }) {
  return <Link {...props} href={href} onNavigate={(event) => {
    // A document navigation gives browser Back a beforeunload boundary for dirty forms.
    event.preventDefault();
    window.location.assign(href);
  }} />;
}
