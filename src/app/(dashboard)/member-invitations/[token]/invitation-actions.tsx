"use client";

import Link from "next/link";
import { useState } from "react";
import { AccountForm } from "@/app/(account)/_components/account-form";
import { memberProblems } from "@/modules/wedding/member-errors";
import { LogoutButton } from "../../_components/logout-button";
import styles from "./invitation.module.css";

export function InvitationActions({ token, email, signedInEmail, state }: {
  token: string;
  email: string;
  signedInEmail?: string;
  state: "guest" | "mismatch" | "member" | "ready";
}) {
  const [mode, setMode] = useState<"login" | "signup" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requireLogin, setRequireLogin] = useState(false);
  const invitePath = "/member-invitations/" + token;

  async function join() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/member-invitations/" + token + "/accept", { method: "POST" });
      if (response.ok) {
        window.location.replace("/app");
        return;
      }
      const result = await response.json().catch(() => null);
      setError(result?.error?.message ?? "We couldn’t accept the invitation. Please try again.");
      if (response.status === 401) setRequireLogin(true);
    } catch {
      setError("We couldn’t connect. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.actionCard} aria-labelledby="join-heading">
      <h2 id="join-heading">Join the wedding workspace</h2>
      {state !== "ready" && <p className={styles.emailBlock}>Invited email <strong>{email}</strong></p>}

      {(state === "guest" || requireLogin) ? (
        mode ? (
          <AccountForm key={mode} mode={mode} invitation={{
            email,
            returnTo: invitePath,
            switchMode: () => setMode(mode === "login" ? "signup" : "login"),
          }} />
        ) : (
          <>
            <p>Log in or create an account with the invited email address.</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => { setError(""); setMode("signup"); }}>Create account</button>
              <button type="button" className={styles.secondary} onClick={() => { setError(""); setMode("login"); }}>Log in</button>
            </div>
          </>
        )
      ) : (
        <>
          <p className={styles.emailBlock}>Signed in as <strong>{signedInEmail}</strong></p>
          {state === "mismatch" && <p className={styles.error}>{memberProblems.INVITATION_EMAIL_MISMATCH.message}</p>}
          {state === "member" && <p className={styles.error}>{memberProblems.ALREADY_HAS_WEDDING.message}</p>}
          <div className={styles.actions}>
            {state === "ready" && <button type="button" className={styles.primary} disabled={saving} onClick={join}>
              {saving ? "Joining…" : "Join wedding workspace"}
            </button>}
            {state === "member" && <Link href="/app" className={styles.primary}>Open my workspace</Link>}
            <LogoutButton className={styles.secondary} label="Switch account" returnTo={invitePath} />
          </div>
        </>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
