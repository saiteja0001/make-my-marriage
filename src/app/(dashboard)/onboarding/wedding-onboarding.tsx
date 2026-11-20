"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  defaultWeddingTimeZone,
  weddingCreationSchema,
  weddingFieldLimits,
} from "@/modules/wedding/validation";
import { formatWeddingDate } from "@/modules/wedding/wedding-date";
import { suggestDescriptionCapitalization, suggestNameCapitalization } from "@/modules/wedding/wedding-text";
import styles from "./onboarding.module.css";

const steps = [
  {
    label: "Couple Details",
    heading: "Let’s Begin Your Wedding Journey",
    description: "Every beautiful wedding starts with a beautiful story. Tell us a little about yours.",
  },
  {
    label: "Wedding Details",
    heading: "When & Where Is the Big Day?",
    description: "Let’s set the date and location for your celebration.",
  },
  {
    label: "Personalize",
    heading: "Make It Yours",
    description: "Add a personal touch to your wedding workspace.",
  },
];

const initialDraft = {
  brideName: "",
  groomName: "",
  weddingDate: "",
  location: "",
  timeZone: defaultWeddingTimeZone,
  title: "",
  description: "",
};

type FieldName = keyof typeof initialDraft;
type FieldErrors = Record<string, string>;

const stepFields = [
  ["brideName", "groomName"],
  ["weddingDate", "location.formattedAddress", "location", "timeZone"],
  ["title", "description"],
];

const stepSchemas = [
  weddingCreationSchema.pick({ brideName: true, groomName: true }),
  weddingCreationSchema.pick({ weddingDate: true, location: true, timeZone: true }),
  weddingCreationSchema,
];

function Field({ name, label, optional, error, children }: {
  name: FieldName;
  label: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={"wedding-" + name}>
        {label} {optional && <span className={styles.optional}>Optional</span>}
      </label>
      {children}
      {error && <p id={"wedding-" + name + "-error"} className={styles.fieldError}>{error}</p>}
    </div>
  );
}

export function WeddingOnboarding({ draftAccountId, timeZones }: { draftAccountId: string; timeZones: string[] }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState("");
  const [accountAction, setAccountAction] = useState<"login" | "switch" | null>(null);
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const activeStep = steps[step];
  const lastStep = step === steps.length - 1;
  const couple = [draft.brideName.trim(), draft.groomName.trim()].filter(Boolean).join(" & ");
  const weddingDate = formatWeddingDate(draft.weddingDate);
  const weddingLocation = draft.location.trim();

  function goToStep(next: number) {
    setStep(next);
    setSaveError("");
    setAccountAction(null);
    requestAnimationFrame(() => heading.current?.focus());
  }

  function focusErrors(fieldErrors: FieldErrors) {
    setErrors(fieldErrors);
    const firstStep = stepFields.findIndex((fields) => fields.some((field) => fieldErrors[field]));
    if (firstStep === -1) return;
    setStep(firstStep);
    const firstField = stepFields[firstStep].find((field) => fieldErrors[field])?.split(".")[0];
    requestAnimationFrame(() => document.getElementById("wedding-" + firstField)?.focus());
  }

  function errorFor(name: FieldName) {
    return errors[name] || (name === "location" ? errors["location.formattedAddress"] : undefined);
  }

  function updateField(name: FieldName, value: string) {
    setDraft((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name === "location" ? "location.formattedAddress" : name]: "", [name]: "" }));
  }

  function input(name: FieldName) {
    const id = "wedding-" + name;
    const error = errorFor(name);
    return {
      id,
      name,
      value: draft[name],
      className: styles.control,
      "aria-invalid": error ? true as const : undefined,
      "aria-describedby": error ? id + "-error" : undefined,
      onChange: (event: { currentTarget: { value: string } }) => updateField(name, event.currentTarget.value),
    };
  }

  function capitalizationAction(name: "brideName" | "groomName" | "description", label: string) {
    const value = draft[name];
    const isDescription = name === "description";
    const suggestion = isDescription ? suggestDescriptionCapitalization(value) : suggestNameCapitalization(value);
    const limit = isDescription ? weddingFieldLimits.description : weddingFieldLimits.name;
    if (suggestion === value.trim() || suggestion.length > limit) return null;

    return (
      <button
        type="button"
        className={styles.capitalize}
        onClick={() => {
          updateField(name, suggestion);
          document.getElementById("wedding-" + name)?.focus();
        }}
      >
        {label}
      </button>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const payload = { ...draft, location: { formattedAddress: draft.location } };
    const validation = stepSchemas[step].safeParse(payload);
    if (!validation.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of validation.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
      focusErrors(fieldErrors);
      return;
    }
    setErrors({});
    if (!lastStep) {
      goToStep(step + 1);
      return;
    }

    setSaveError("");
    setAccountAction(null);
    setSaving(true);
    try {
      const response = await fetch("/api/wedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, draftAccountId }),
      });
      const result = response.ok ? null : await response.json().catch(() => null);
      if (response.ok || result?.error?.code === "ALREADY_HAS_WEDDING") {
        window.location.replace("/app");
        return;
      }
      if (response.status === 401) {
        setAccountAction("login");
        setSaveError("Your session expired. Log in to finish creating your wedding.");
      } else if (result?.error?.code === "ACCOUNT_CHANGED") {
        setAccountAction("switch");
        setSaveError("You’re signed in to a different account. Open the workspace in a new tab, log out, and log back in to the account that started this draft.");
      } else if (result?.error?.details && Object.keys(result.error.details).length > 0) {
        focusErrors(result.error.details);
      } else {
        setSaveError("We couldn’t save your wedding. Your details are still here. Please try again.");
      }
    } catch {
      setSaveError("We couldn’t connect. Your details are still here. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.shell}>
      <nav className={styles.progress} aria-label="Onboarding progress">
        <p className={styles.progressLabel}>Step {step + 1} of {steps.length} <span>{activeStep.label}</span></p>
        <ol className={styles.progressSteps}>
          {steps.map(({ label }, index) => (
            <li key={label} data-complete={index < step} aria-current={index === step ? "step" : undefined}>
              <span className={styles.stepNumber}>{index < step ? "✓" : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <div className={styles.progressBar} aria-hidden="true">
          <span style={{ width: ((step + 1) / steps.length) * 100 + "%" }} />
        </div>
      </nav>

      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="onboarding-heading">
          <h1 id="onboarding-heading" ref={heading} tabIndex={-1}>{activeStep.heading}</h1>
          <p className={styles.lead}>{activeStep.description}</p>

          <form method="post" onSubmit={submit} noValidate aria-busy={saving}>
            <fieldset disabled={saving} className={styles.fields}>
              <legend className="sr-only">{activeStep.label}</legend>
              {step === 0 && <>
                <Field name="brideName" label="Bride’s name" error={errorFor("brideName")}>
                  <input {...input("brideName")} placeholder="Enter bride’s name" autoCapitalize="none" maxLength={weddingFieldLimits.name} required />
                  {capitalizationAction("brideName", "Capitalize bride’s name")}
                </Field>
                <div className={styles.divider} aria-hidden="true"><span>♡</span></div>
                <Field name="groomName" label="Groom’s name" error={errorFor("groomName")}>
                  <input {...input("groomName")} placeholder="Enter groom’s name" autoCapitalize="none" maxLength={weddingFieldLimits.name} required />
                  {capitalizationAction("groomName", "Capitalize groom’s name")}
                </Field>
              </>}
              {step === 1 && <>
                <Field name="weddingDate" label="Wedding date" error={errorFor("weddingDate")}>
                  <input {...input("weddingDate")} type="date" required />
                </Field>
                <Field name="location" label="Wedding city or location" error={errorFor("location")}>
                  <input {...input("location")} placeholder="Enter your wedding city" maxLength={weddingFieldLimits.location} required />
                </Field>
                <Field name="timeZone" label="Timezone" error={errorFor("timeZone")}>
                  <select {...input("timeZone")}>
                    {timeZones.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone === defaultWeddingTimeZone ? "India Standard Time (Asia/Kolkata)" : zone.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </Field>
              </>}
              {lastStep && <>
                <div className={styles.review}>
                  <div className={styles.reviewTop}>
                    <h2>{couple}</h2>
                    <button type="button" className={styles.edit} onClick={() => goToStep(0)}>Edit details</button>
                  </div>
                  <dl>
                    <div><dt>Date</dt><dd><time dateTime={draft.weddingDate}>{weddingDate}</time></dd></div>
                    <div><dt>Location</dt><dd>{weddingLocation}</dd></div>
                  </dl>
                </div>
                <Field name="title" label="Wedding title" optional error={errorFor("title")}>
                  <input {...input("title")} placeholder="e.g. Priya & Ashu’s Wedding" maxLength={weddingFieldLimits.title} />
                </Field>
                <Field name="description" label="Short description" optional error={errorFor("description")}>
                  <textarea
                    {...input("description")}
                    placeholder="Share a little about your celebration"
                    autoCapitalize="none"
                    maxLength={weddingFieldLimits.description}
                    rows={3}
                  />
                  {capitalizationAction("description", "Capitalize first letter")}
                </Field>
              </>}
            </fieldset>

            {saveError && <div className={styles.saveError} role="alert">
              <p>{saveError}</p>
              {accountAction === "login" && <Link href="/login" target="_blank" rel="noopener">Open login in a new tab</Link>}
              {accountAction === "switch" && <Link href="/app" target="_blank" rel="noopener">Open workspace in a new tab</Link>}
            </div>}

            <div className={styles.actions}>
              {step > 0 && <button type="button" className={styles.secondary} onClick={() => goToStep(step - 1)} disabled={saving}>
                <span aria-hidden="true">←</span> Back
              </button>}
              <button type="submit" className={styles.primary} disabled={saving}>
                {saving ? "Creating your wedding…" : lastStep ? "Create wedding" : "Continue"}
                {!saving && <span aria-hidden="true">→</span>}
              </button>
            </div>
          </form>
        </section>

        <aside className={styles.preview} aria-label="Wedding workspace preview">
          <div className={styles.previewPhoto}>
            <Image
              src="/wedding-hero.jpg"
              alt=""
              fill
              sizes="(max-width: 54rem) 90vw, 35vw"
              className={styles.photo}
            />
            <span className={styles.previewBadge}>Wedding preview</span>
          </div>
          <div className={styles.previewBody}>
            {couple ? <h2>{draft.title.trim() || couple}</h2> : <p className={styles.previewQuote}>
              “Every beautiful celebration begins with a plan.”
            </p>}
            {(weddingDate || weddingLocation) && <p className={styles.previewDetails}>
              {[weddingDate, weddingLocation].filter(Boolean).join(" · ")}
            </p>}
          </div>
        </aside>
      </div>
    </main>
  );
}
