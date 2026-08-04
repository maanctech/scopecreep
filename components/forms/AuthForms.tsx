"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type SubmissionState = { kind: "idle" | "loading" | "error" | "success"; message: string };

async function submit(endpoint: string, payload: Record<string, string>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = (await response.json()) as { error?: string };

  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
}

function Status({ state }: { state: SubmissionState }) {
  if (state.kind === "idle" || state.kind === "loading") return null;

  return (
    <p
      role="status"
      className={`
        rounded-md border px-3 py-2 text-sm
        ${
        state.kind === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }
      `}
    >
      {state.message}
    </p>
  );
}

const inputClass = "mt-1 h-11 w-full rounded-md border border-audit-border px-3 text-base outline-hidden focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";
const buttonClass = "inline-flex h-11 items-center justify-center rounded-md bg-ink px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60";

export function LoginForm({ nextPath = "/app" }: { nextPath?: string }) {
  const router = useRouter();
  const [state, setState] = useState<SubmissionState>({ kind: "idle", message: "" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    setState({ kind: "loading", message: "" });

    try {
      await submit("/api/auth/login", { email: String(data.get("email")), password: String(data.get("password")) });
      router.replace(nextPath.startsWith("/") ? nextPath : "/app");
      router.refresh();
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Sign in failed." });
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="block text-sm font-medium">Email<input className={inputClass} name="email" type="email" autoComplete="email" required /></label>
      <label className="block text-sm font-medium">Password<input className={inputClass} name="password" type="password" autoComplete="current-password" required /></label>
      <Status state={state} />
      <button className={buttonClass} disabled={state.kind === "loading"} type="submit">{state.kind === "loading" ? "Signing in..." : "Sign in"}</button>
    </form>
  );
}

export function SetupForm() {
  const router = useRouter();
  const [state, setState] = useState<SubmissionState>({ kind: "idle", message: "" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    setState({ kind: "loading", message: "" });

    try {
      await submit("/api/auth/setup", {
        organizationName: String(data.get("organizationName")),
        displayName: String(data.get("displayName")),
        email: String(data.get("email")),
        password: String(data.get("password"))
      });
      router.replace("/app/settings/ai?setup=complete");
      router.refresh();
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Setup failed." });
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="block text-sm font-medium">Organization name<input className={inputClass} name="organizationName" autoComplete="organization" required /></label>
      <label className="block text-sm font-medium">Your name<input className={inputClass} name="displayName" autoComplete="name" required /></label>
      <label className="block text-sm font-medium">Email<input className={inputClass} name="email" type="email" autoComplete="email" required /></label>
      <label className="block text-sm font-medium">Password<input className={inputClass} name="password" type="password" autoComplete="new-password" minLength={12} required /><span className="
        mt-1 block text-xs text-audit-muted
      ">At least 12 characters with uppercase, lowercase, and a number.</span></label>
      <Status state={state} />
      <button className={buttonClass} disabled={state.kind === "loading"} type="submit">{state.kind === "loading" ? "Creating workspace..." : "Create secure workspace"}</button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, setState] = useState<SubmissionState>({ kind: "idle", message: "" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setState({ kind: "loading", message: "" });

    try {
      await submit("/api/auth/change-password", {
        currentPassword: String(data.get("currentPassword")),
        newPassword: String(data.get("newPassword"))
      });
      form.reset();
      setState({ kind: "success", message: "Password updated. Other sessions were signed out." });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Password update failed." });
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="block text-sm font-medium">Current password<input className={inputClass} name="currentPassword" type="password" autoComplete="current-password" required /></label>
      <label className="block text-sm font-medium">New password<input className={inputClass} name="newPassword" type="password" autoComplete="new-password" minLength={12} required /></label>
      <Status state={state} />
      <button className={buttonClass} disabled={state.kind === "loading"} type="submit">{state.kind === "loading" ? "Updating..." : "Change password"}</button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<SubmissionState>({ kind: "idle", message: "" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    setState({ kind: "loading", message: "" });

    try {
      await submit("/api/auth/reset-password", { token, newPassword: String(data.get("newPassword")) });
      setState({ kind: "success", message: "Password reset. Redirecting to sign in..." });
      window.setTimeout(() => router.replace("/login"), 800);
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Password reset failed." });
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="block text-sm font-medium">New password<input className={inputClass} name="newPassword" type="password" autoComplete="new-password" minLength={12} required /></label>
      <Status state={state} />
      <button className={buttonClass} disabled={!token || state.kind === "loading"} type="submit">{state.kind === "loading" ? "Resetting..." : "Reset password"}</button>
    </form>
  );
}
