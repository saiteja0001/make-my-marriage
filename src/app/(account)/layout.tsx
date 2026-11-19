import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui/wordmark";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line px-5 py-5 sm:px-10">
        <div className="mx-auto max-w-7xl"><Wordmark /></div>
      </header>
      <main className="mx-auto max-w-lg px-5 py-10 sm:py-16">{children}</main>
    </>
  );
}
