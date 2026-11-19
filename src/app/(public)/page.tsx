import Image from "next/image";
import Link from "next/link";
import { ActionLink } from "@/components/ui/action-link";
import { Wordmark } from "@/components/ui/wordmark";

export default function HomePage() {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-3 sm:px-10">
          <Wordmark />
          <nav aria-label="Account" className="flex items-center gap-4 sm:gap-6">
            <Link href="/login" className="rounded-sm text-sm font-semibold hover:underline">
              Log in
            </Link>
            <ActionLink href="/signup" variant="secondary">Sign up</ActionLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-9 sm:px-10 sm:py-14 md:grid-cols-2 lg:gap-16 lg:py-16">
        <div className="py-3 sm:py-6">
          <h1 className="max-w-[11ch] font-display text-5xl leading-[1.03] tracking-[-0.055em] text-pine sm:text-6xl lg:text-7xl">
            Your wedding, planned <em className="text-clay">together.</em>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg">
            Bring both families into one shared workspace for your wedding events,
            to-dos, and guest list.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ActionLink href="/app">View demo dashboard</ActionLink>
            <ActionLink href="/signup" variant="secondary">Sign up</ActionLink>
          </div>
        </div>
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] bg-blush sm:aspect-[5/4] md:aspect-[4/5]">
          <Image
            src="/wedding-hero.jpg"
            alt="A bride and groom smiling beneath a marigold-draped arch"
            fill
            preload
            sizes="(min-width: 1280px) 568px, (min-width: 768px) 48vw, 100vw"
            className="object-cover object-[50%_36%]"
          />
        </div>
      </main>
    </>
  );
}
