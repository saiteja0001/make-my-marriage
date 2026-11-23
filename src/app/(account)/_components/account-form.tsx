"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { ActionLink } from "@/components/ui/action-link";
import { signupPasswordMinLength } from "@/modules/auth/password-policy";

type FieldName = "name" | "email" | "password";
type FormError = { message: string; details?: Partial<Record<FieldName, string>> };

const inputStyle =
  "min-h-11 w-full rounded-lg border border-line bg-paper px-3 aria-invalid:border-clay";

type AccountFieldProps = {
  name: FieldName;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete: string;
  error?: string;
  minLength?: number;
  endControl?: ReactNode;
  fixedValue?: string;
};

function AccountField({
  name, label, type = "text", autoComplete, error, minLength, endControl, fixedValue,
}: AccountFieldProps) {
  const inputId = "account-" + name;
  const errorId = inputId + "-error";
  const hintId = inputId + "-hint";
  const describedBy = [minLength && hintId, error && errorId].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium">{label}</label>
      <div className="relative mt-1.5">
        <input
          id={inputId}
          className={endControl ? inputStyle + " pr-20" : inputStyle}
          type={type}
          name={name}
          autoComplete={autoComplete}
          autoCapitalize={name === "password" ? "none" : undefined}
          spellCheck={name === "password" ? false : undefined}
          minLength={minLength}
          defaultValue={fixedValue}
          readOnly={fixedValue !== undefined}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
        />
        {endControl}
      </div>
      {minLength && <p className="mt-1 text-sm text-muted" id={hintId}>Use at least {minLength} characters.</p>}
      {error && <p className="mt-1 text-sm text-clay" id={errorId}>{error}</p>}
    </div>
  );
}

export function AccountForm({ mode, invitation }: {
  mode: "login" | "signup";
  invitation?: { email: string; returnTo: string; switchMode: () => void };
}) {
  const isSignup = mode === "signup";
  const Heading = invitation ? "h2" : "h1";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form);
    setError(null);
    setPending(true);

    try {
      const result = await fetch("/api/auth/" + mode, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (result.ok) {
        window.location.replace(invitation?.returnTo ?? "/app");
        return;
      }

      const data = await result.json().catch(() => null);
      setError(data?.error ?? { message: "Account access is temporarily unavailable." });
    } catch {
      setError({ message: "We could not connect. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="panel p-6 sm:p-9">
      <Heading className="font-display text-4xl tracking-tight text-pine">
        {isSignup ? "Create an account" : "Log in"}
      </Heading>
      <form className="mt-6" method="post" onSubmit={submit} aria-busy={pending}>
        <fieldset disabled={pending} className="grid gap-4">
          <legend className="sr-only">Account details</legend>
          {isSignup && (
            <AccountField name="name" label="Name" autoComplete="name" error={error?.details?.name} />
          )}
          <AccountField name="email" label="Email" type="email" autoComplete="email" error={error?.details?.email} fixedValue={invitation?.email} />
          <AccountField
            name="password"
            label="Password"
            type={passwordVisible ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? signupPasswordMinLength : undefined}
            error={error?.details?.password}
            endControl={
              <button
                type="button"
                aria-controls="account-password"
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                onClick={() => setPasswordVisible((visible) => !visible)}
                className="absolute inset-y-0 right-0 min-w-16 rounded-r-lg px-2 text-sm font-semibold text-pine hover:bg-sage"
              >
                {passwordVisible ? "Hide" : "Show"}
              </button>
            }
          />
        </fieldset>
        {error && <p className="mt-4 text-sm font-medium text-clay" role="alert">{error.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-6 min-h-11 w-full rounded-lg bg-pine px-4 py-2.5 text-sm font-semibold text-white hover:bg-pine-hover disabled:opacity-70"
        >
          {pending ? (isSignup ? "Creating your account…" : "Logging in…") : (isSignup ? "Create account" : "Log in")}
        </button>
      </form>
      <p className="mt-5 text-sm text-muted">
        {isSignup ? "Already have an account?" : "New to Make My Marriage?"}{" "}
        {invitation ? <button type="button" disabled={pending} onClick={invitation.switchMode} className="rounded-sm font-semibold text-pine underline underline-offset-4 disabled:opacity-70">
          {isSignup ? "Log in" : "Sign up"}
        </button> : <Link
          href={isSignup ? "/login" : "/signup"}
          className="rounded-sm font-semibold text-pine underline underline-offset-4"
        >
          {isSignup ? "Log in" : "Sign up"}
        </Link>}
      </p>
      {!invitation && <div className="mt-5 grid">
        <ActionLink href="/demo" variant="secondary">Explore the demo</ActionLink>
      </div>}
    </div>
  );
}
