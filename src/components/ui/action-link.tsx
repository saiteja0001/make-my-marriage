import Link from "next/link";
import type { ReactNode } from "react";

const treatments = {
  primary: "border-pine bg-pine text-white hover:border-pine-hover hover:bg-pine-hover",
  secondary: "border-line bg-white text-ink hover:border-pine",
};

export function ActionLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof treatments;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${treatments[variant]}`}
    >
      {children}
    </Link>
  );
}
