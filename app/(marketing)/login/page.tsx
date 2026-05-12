"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadSessionFromIdToken } from "@/lib/auth/client-session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/store/zustand/session-store";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function friendlySignInError(message: string) {
    const lower = message.toLowerCase();
    if (lower.includes("user not provisioned")) {
      return "This Supabase user is missing an app profile. Create the company account again.";
    }
    if (lower.includes("invalid or expired token")) {
      return "Supabase sign-in worked, but the app profile could not be loaded. Create the company account again.";
    }
    return message;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.trim()) {
      setErr("Enter your email.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.session?.access_token) {
        throw new Error(error?.message ?? "Sign-in failed");
      }
      await loadSessionFromIdToken(data.session.access_token, setSession);
      router.push("/analytics");
    } catch (unknown) {
      const msg = unknown instanceof Error ? unknown.message : "Sign-in failed";
      setErr(friendlySignInError(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-gradient-to-br from-[color:var(--color-primary)] via-[#0747a6] to-[#0c2d6b] p-10 text-[color:var(--color-primary-contrast)] md:flex">
        <Link
          href="/"
          className="text-lg font-semibold text-[color:var(--color-primary-contrast)]"
        >
          Store OMS
        </Link>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">
            Precision logistics, one login away.
          </h1>
          <p className="max-w-md text-sm text-white/85">
            Unified orders, shipments, and support workflows — built for teams
            that cannot afford downtime.
          </p>
        </div>
        <p className="text-xs text-white/60">
          © {new Date().getFullYear()} Store OMS
        </p>
      </div>
      <div className="flex flex-col items-center justify-center bg-[color:var(--color-app-main)] px-4 py-12">
        <div className="w-full max-w-md rounded-[var(--ds-radius-md)] border border-[color:var(--color-divider)] bg-[color:var(--color-shell)] p-8 shadow-none md:p-10">
          <h2 className="text-xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            Use the email and password for your Supabase account.
          </p>
          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
            <Input
              type="email"
              label="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
            <Input
              type="password"
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {err ? (
              <p className="text-sm text-[color:var(--color-error)]">{err}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Continue"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-[color:var(--color-text-muted)]">
            New company?{" "}
            <Link
              href="/register"
              className="font-medium text-[color:var(--color-primary)] hover:underline"
            >
              Create an account
            </Link>
          </p>
          <p className="mt-4 text-center text-sm text-[color:var(--color-text-muted)]">
            <Link href="/" className="text-[color:var(--color-primary)] hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
