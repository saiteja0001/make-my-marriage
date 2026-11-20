"use client";

import { useState } from "react";

export function LogoutButton({ className }: { className: string }) {
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
        className={className}
      >
        {pending ? "Logging out…" : "Log out"}
      </button>
      {failed && <p className="mt-2 text-sm text-clay" role="alert">We couldn’t log you out. Please try again.</p>}
    </div>
  );
}
