import type { ReactNode } from "react";
import { WorkspaceNavigation } from "./_components/workspace-navigation";
import { demoWedding } from "@/app/_data/demo-wedding";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#workspace-content"
        className="sr-only z-20 rounded-lg bg-white px-4 py-2 text-pine focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to workspace content
      </a>
      <WorkspaceNavigation />
      <div>
        <header className="flex min-h-17 flex-wrap items-center justify-between gap-3 border-b border-line bg-white/65 px-5 py-3 sm:px-8">
          <p className="font-semibold text-pine">{demoWedding.couple}</p>
          <p className="rounded-full bg-sage px-3 py-1 text-sm font-medium text-pine">
            Demo workspace
          </p>
        </header>
        <main id="workspace-content" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
