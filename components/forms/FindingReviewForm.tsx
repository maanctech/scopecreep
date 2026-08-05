"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  availableActions,
  type FindingActionName
} from "@/lib/domain/findingTransitions";
import { dollarsToCents, formatCents } from "@/lib/domain/money";
import type { ScopeFinding } from "@/lib/types";

const CONFIRMATIONS: Partial<Record<FindingActionName, string>> = {
  "Mark as Invoiced":
    "Record that you invoiced the client yourself? This app does not send invoices or contact your client.",
  "Mark as Paid":
    "Record this as paid? This only updates your internal tracker. It does not charge the client.",
  "Reject Finding": "Reject this finding? It will move to Rejected and will not be billed.",
  "Mark as Courtesy":
    "Mark this work as a courtesy? It will not be billed and will move out of your review list.",
  "Reopen Finding":
    "Reopen this finding? Its decision and approved amounts will be cleared so you can review it again."
};

const ACTION_HINTS: Record<FindingActionName, string> = {
  "Mark as Billable": "You plan to bill this work separately.",
  "Include in Retainer": "Covered by an existing retainer. Never invoiced.",
  "Discuss With Client": "You want to talk with the client before deciding.",
  "Mark as Courtesy": "You choose not to bill this work.",
  "Reject Finding": "The AI got it wrong or you disagree.",
  "Mark as Invoiced": "You sent the invoice or change order yourself.",
  "Mark as Paid": "The client paid the invoice you sent.",
  "Reopen Finding": "Undo the decision and review this finding again."
};

export function FindingReviewForm({ finding }: { finding: ScopeFinding }) {
  const router = useRouter();
  const [currentFinding, setCurrentFinding] = useState(finding);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [approvedHours, setApprovedHours] = useState(
    finding.approved_hours === null ? "" : String(finding.approved_hours)
  );
  const [approvedDollars, setApprovedDollars] = useState(
    finding.approved_amount_cents === null
      ? ""
      : (finding.approved_amount_cents / 100).toFixed(2)
  );
  const [explanation, setExplanation] = useState(finding.client_facing_explanation);
  const [note, setNote] = useState(finding.internal_note ?? "");

  const actions = availableActions(currentFinding);
  const amountsEditable = currentFinding.workflow_status === "Decided";

  function adoptFinding(next: ScopeFinding) {
    setCurrentFinding(next);
    setApprovedHours(next.approved_hours === null ? "" : String(next.approved_hours));
    setApprovedDollars(
      next.approved_amount_cents === null ? "" : (next.approved_amount_cents / 100).toFixed(2)
    );
    setExplanation(next.client_facing_explanation);
    setNote(next.internal_note ?? "");
  }

  function currentReviewPayload() {
    const review: Record<string, unknown> = {
      client_facing_explanation: explanation.trim() || currentFinding.client_facing_explanation,
      internal_note: note.trim() || null
    };

    if (!amountsEditable) return review;

    const hours = approvedHours.trim() === "" ? null : Number(approvedHours);

    if (hours !== null && (!Number.isFinite(hours) || hours < 0)) {
      throw new Error("Approved hours must be a number of 0 or more.");
    }

    const dollars = approvedDollars.trim() === "" ? null : Number(approvedDollars);

    if (dollars !== null && (!Number.isFinite(dollars) || dollars < 0)) {
      throw new Error("Approved amount must be a dollar amount of 0 or more.");
    }

    review.approved_hours = hours;
    review.approved_amount_cents = dollars === null ? null : dollarsToCents(dollars);

    return review;
  }

  async function submitAction(action: FindingActionName) {
    const confirmation = CONFIRMATIONS[action];

    if (confirmation && !window.confirm(confirmation)) return;

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/findings/${encodeURIComponent(currentFinding.id)}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            expected_version: currentFinding.version,
            review: currentReviewPayload()
          })
        }
      );
      const json = (await response.json()) as { error?: string; finding?: ScopeFinding };

      if (!response.ok) {
        if (response.status === 409 && json.finding) {
          adoptFinding(json.finding);
        }

        throw new Error(json.error || "The action could not be completed.");
      }

      if (!json.finding) {
        throw new Error("The server saved the action but returned no updated finding.");
      }

      adoptFinding(json.finding);
      setSuccess(`Saved: ${action}.`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "The action could not be completed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      expected_version: currentFinding.version,
      client_facing_explanation: explanation.trim() || currentFinding.client_facing_explanation,
      internal_note: note.trim() ? note.trim() : null
    };

    if (amountsEditable) {
      const hours = approvedHours.trim() === "" ? null : Number(approvedHours);

      if (hours !== null && (!Number.isFinite(hours) || hours < 0)) {
        setError("Approved hours must be a number of 0 or more.");

        return;
      }

      const dollars = approvedDollars.trim() === "" ? null : Number(approvedDollars);

      if (dollars !== null && (!Number.isFinite(dollars) || dollars < 0)) {
        setError("Approved amount must be a dollar amount of 0 or more.");

        return;
      }

      payload.approved_hours = hours;
      payload.approved_amount_cents = dollars === null ? null : dollarsToCents(dollars);
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/findings/${encodeURIComponent(currentFinding.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = (await response.json()) as { error?: string; finding?: ScopeFinding };

      if (!response.ok) {
        if (response.status === 409 && json.finding) {
          adoptFinding(json.finding);
        }

        throw new Error(json.error || "Your changes could not be saved.");
      }

      if (!json.finding) {
        throw new Error("The server saved your changes but returned no updated finding.");
      }

      adoptFinding(json.finding);
      setSuccess("Your changes were saved.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Your changes could not be saved."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-base font-semibold">Billing decision</h4>
        <p className="mt-1 text-sm text-audit-muted">
          This is private. Your client will not see this. AI suggestions require human review
          before billing.
        </p>
        <div className="
          mt-3 grid gap-3
          sm:grid-cols-2
        ">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              disabled={isSubmitting}
              onClick={() => submitAction(action)}
              className="
                rounded-md border border-audit-border bg-white px-4 py-3
                text-left
                hover:bg-audit-soft
                focus:ring-2 focus:ring-ink focus:outline-hidden
                disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              <span className="block text-sm font-semibold text-ink">{action}</span>
              <span className="mt-1 block text-sm text-audit-muted">{ACTION_HINTS[action]}</span>
            </button>
          ))}
        </div>
        {actions.includes("Mark as Paid") ? (
          <p className="mt-2 text-sm text-audit-muted">
            Marking this as paid only updates your internal tracker. It does not charge the client.
          </p>
        ) : null}
      </div>

      <form onSubmit={saveDetails} className="
        space-y-4 rounded-md border border-audit-border bg-audit-soft p-4
      ">
        <h4 className="text-base font-semibold">Your review details</h4>
        <div className="
          grid gap-4
          sm:grid-cols-2
        ">
          <label className="block">
            <span className="text-sm font-medium">Approved hours</span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={approvedHours}
              onChange={(event) => setApprovedHours(event.target.value)}
              disabled={!amountsEditable || isSubmitting}
              className="
                mt-2 w-full rounded-md border border-audit-border px-3 py-2
                disabled:bg-zinc-100
              "
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Approved amount (dollars)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={approvedDollars}
              onChange={(event) => setApprovedDollars(event.target.value)}
              disabled={!amountsEditable || isSubmitting}
              className="
                mt-2 w-full rounded-md border border-audit-border px-3 py-2
                disabled:bg-zinc-100
              "
            />
          </label>
        </div>
        {!amountsEditable ? (
          <p className="text-sm text-audit-muted">
            {currentFinding.workflow_status === "Invoiced" ||
            currentFinding.workflow_status === "Paid"
              ? "Amounts are locked after invoicing. Reopen the finding to change them."
              : "Choose Mark as Billable or Include in Retainer first, then you can adjust the approved hours and amount."}
          </p>
        ) : (
          <p className="text-sm text-audit-muted">
            Current approved amount:{" "}
            {currentFinding.approved_amount_cents === null
              ? "not set"
              : formatCents(currentFinding.approved_amount_cents)}
            . Amounts are stored exactly, in cents.
          </p>
        )}

        <label className="block">
          <span className="text-sm font-medium">Client-facing draft (you send this yourself)</span>
          <textarea
            rows={4}
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            disabled={isSubmitting}
            className="
              mt-2 w-full rounded-md border border-audit-border px-3 py-2
            "
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Internal note (private)</span>
          <textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={isSubmitting}
            className="
              mt-2 w-full rounded-md border border-audit-border px-3 py-2
            "
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="
            inline-flex h-11 items-center justify-center rounded-md bg-ink px-5
            text-sm font-semibold text-white
            hover:bg-zinc-800
            disabled:cursor-not-allowed disabled:opacity-60
          "
        >
          {isSubmitting ? "Saving..." : "Save review details"}
        </button>
      </form>

      <div aria-live="polite" role="status">
        {success ? (
          <div className="
            rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm
            text-emerald-800
          ">
            {success}
          </div>
        ) : null}
        {error ? (
          <div className="
            rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700
          ">
            {error} {error.includes("changed since") ? "Reload the page to see the latest version." : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
}
