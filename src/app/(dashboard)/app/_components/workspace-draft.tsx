"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { WorkspaceShell } from "./workspace-shell";
import styles from "./workspace-shell.module.css";

type DraftState = { dirty: boolean; saving: boolean };
const emptyDraft: DraftState = { dirty: false, saving: false };
const DraftContext = createContext<{
  register: (draft: DraftState) => () => void;
  requestLeave: (leave: () => void) => void;
  allowNavigation: () => void;
} | null>(null);

export function WorkspaceDraftShell(props: Pick<ComponentProps<typeof WorkspaceShell>, "children" | "member" | "currentPath">) {
  const [draft, setDraft] = useState(emptyDraft);
  const allowed = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pendingLeave = useRef<(() => void) | null>(null);

  const register = useCallback((next: DraftState) => {
    setDraft(next);
    return () => setDraft(emptyDraft);
  }, []);
  const allowNavigation = useCallback(() => { allowed.current = true; }, []);
  const requestLeave = useCallback((leave: () => void) => {
    if (draft.saving) return;
    if (!draft.dirty) {
      leave();
      return;
    }
    pendingLeave.current = leave;
    dialog.current?.showModal();
  }, [draft]);

  useEffect(() => {
    function restoreNavigationGuard(event: PageTransitionEvent) {
      if (event.persisted) allowed.current = false;
    }
    window.addEventListener("pageshow", restoreNavigationGuard);
    return () => window.removeEventListener("pageshow", restoreNavigationGuard);
  }, []);

  useEffect(() => {
    if (!draft.dirty) return;
    function confirmUnload(event: BeforeUnloadEvent) {
      if (allowed.current) return;
      event.preventDefault();
      event.returnValue = true;
    }
    window.addEventListener("beforeunload", confirmUnload);
    return () => window.removeEventListener("beforeunload", confirmUnload);
  }, [draft.dirty]);

  const context = useMemo(() => ({ register, requestLeave, allowNavigation }), [register, requestLeave, allowNavigation]);
  return (
    <DraftContext.Provider value={context}>
      <WorkspaceShell {...props} onRequestLeave={draft.dirty || draft.saving ? requestLeave : undefined} onNavigateAway={allowNavigation} />
      <dialog ref={dialog} className={styles.draftDialog} aria-labelledby="workspace-discard-title" aria-describedby="workspace-discard-description"
        onClose={() => { pendingLeave.current = null; }}>
        <h2 id="workspace-discard-title">Discard unsaved changes?</h2>
        <p id="workspace-discard-description">Your edits will be lost if you leave this page.</p>
        <div className={styles.draftActions}>
          <button type="button" onClick={() => dialog.current?.close()}>Keep editing</button>
          <button type="button" onClick={() => {
            const leave = pendingLeave.current;
            dialog.current?.close();
            leave?.();
          }}>Discard changes</button>
        </div>
      </dialog>
    </DraftContext.Provider>
  );
}

export function useWorkspaceDraft(dirty: boolean, saving: boolean) {
  const context = useContext(DraftContext);
  if (!context) throw new Error("Draft forms require the workspace draft shell.");
  const { register, requestLeave, allowNavigation } = context;
  useEffect(() => register({ dirty, saving }), [dirty, saving, register]);

  function leaveFor(href: string) {
    return (event: { preventDefault: () => void }) => {
      event.preventDefault();
      requestLeave(() => {
        allowNavigation();
        window.location.assign(href);
      });
    };
  }

  return { leaveFor, allowNavigation, requestLeave };
}
