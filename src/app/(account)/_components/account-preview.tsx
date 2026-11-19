import Link from "next/link";
import { ActionLink } from "@/components/ui/action-link";

const inputStyle =
  "mt-1.5 min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-muted";

export function AccountPreview({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";

  return (
    <div className="panel p-6 sm:p-9">
      <h1 className="font-display text-4xl tracking-tight text-pine">
        {isSignup ? "Create an account" : "Log in"}
      </h1>
      <p id="account-preview-note" className="mt-3 leading-relaxed text-muted">
        Account access is a preview. Explore the sample wedding dashboard
        without entering any details.
      </p>
      <fieldset
        aria-describedby="account-preview-note"
        disabled
        className="mt-6 grid gap-4"
      >
        <legend className="sr-only">Account fields</legend>
        {isSignup && (
          <label className="text-sm font-medium">
            Name
            <input className={inputStyle} name="name" autoComplete="name" />
          </label>
        )}
        <label className="text-sm font-medium">
          Email
          <input className={inputStyle} name="email" type="email" autoComplete="email" />
        </label>
        <label className="text-sm font-medium">
          Password
          <input
            className={inputStyle}
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
        </label>
      </fieldset>
      <div className="mt-6 grid">
        <ActionLink href="/app">View demo dashboard</ActionLink>
      </div>
      <p className="mt-5 text-sm text-muted">
        {isSignup ? "Already have an account?" : "New to Make My Marriage?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="rounded-sm font-semibold text-pine underline underline-offset-4"
        >
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </div>
  );
}
