"use client";

import { useState } from "react";

export function LogoutButton({ className, onRequestLeave, onLoggedOut }: {
  className: string;
  onRequestLeave?: (leave: () => void) => void;
  onLoggedOut?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    setPending(true);
    setFailed(false);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok && response.status !== 401) throw new Error();
      onLoggedOut?.();
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
        onClick={() => onRequestLeave ? onRequestLeave(submit) : void submit()}
        disabled={pending}
        className={className}
      >
        {pending ? "Logging out…" : "Log out"}
      </button>
      {failed && <p className="mt-2 text-sm text-clay" role="alert">We couldn’t log you out. Please try again.</p>}
    </div>
  );
}
