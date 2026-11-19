import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" className="inline-flex w-fit items-center gap-2.5 rounded-sm">
      <span aria-hidden="true" className="brand-mark" />
      <span className="font-display text-xl font-bold tracking-tight">
        Make My Marriage
      </span>
    </Link>
  );
}
