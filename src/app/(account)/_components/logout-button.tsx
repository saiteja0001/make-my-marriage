"use client";

import { useState } from "react";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    setPending(true);
    setFailed(false);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok && response.status !== 401) throw new Error();
      window.location.replace("/login");
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="min-h-11 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-pine disabled:opacity-70"
      >
        {pending ? "Logging out…" : "Log out"}
      </button>
      {failed && <p className="mt-2 text-sm text-clay" role="alert">We couldn’t log you out. Please try again.</p>}
    </div>
  );
}
