import Link from "next/link";

export function BrandMark() {
  return <span aria-hidden="true" className="brand-mark">M</span>;
}

export function Wordmark() {
  return (
    <Link href="/" className="inline-flex w-fit items-center gap-2.5 rounded-sm">
      <BrandMark />
      <span className="font-display text-xl font-bold tracking-tight">
        Make My Marriage
      </span>
    </Link>
  );
}
