"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadSessionFromIdToken } from "@/lib/auth/client-session";
import {
  getFirebaseClientAuth,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import { useSessionStore } from "@/store/zustand/session-store";

const defaultTenant =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? "default"
    : "default";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantIdIn, setTenantIdIn] = useState(defaultTenant);
  const [userIdIn, setUserIdIn] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firebaseOn = isFirebaseClientConfigured();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.trim()) {
      setErr("Enter your email.");
      return;
    }
    setBusy(true);
    try {
      if (firebaseOn) {
        const auth = getFirebaseClientAuth();
        const cred = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        const idToken = await cred.user.getIdToken();
        await loadSessionFromIdToken(idToken, setSession);
        router.push("/analytics");
        return;
      }

      const tid = tenantIdIn.trim() || defaultTenant;
      const uid =
        userIdIn.trim() ||
        (email.trim().split("@")[0] || "user").replace(/[^a-zA-Z0-9_-]/g, "");
      const local = email.trim().split("@")[0] || "User";
      const displayName = local
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setSession({
        idToken: "",
        userId: uid,
        displayName,
        apiSecret: password.trim() || "demo-token",
        tenantId: tid,
        role: "admin",
      });
      router.push("/analytics");
    } catch (unknown) {
      const msg =
        unknown instanceof Error ? unknown.message : "Sign-in failed";
      setErr(msg);
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
          Hakimo OMS
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
          © {new Date().getFullYear()} Hakimo OMS
        </p>
      </div>
      <div className="flex flex-col items-center justify-center bg-[color:var(--color-app-main)] px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[color:var(--color-divider)] bg-[color:var(--color-shell)] p-8 shadow-[var(--shadow-neo-raised-lg)] md:p-10">
          <h2 className="text-xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            {firebaseOn
              ? "Use the email and password for your Firebase account."
              : "Use your staff API key (Bearer) or server OMS secret as the password. Set tenant and user id if you are not on the default demo."}
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
            {!firebaseOn ? (
              <>
                <Input
                  label="Tenant ID"
                  value={tenantIdIn}
                  onChange={(e) => setTenantIdIn(e.target.value)}
                  placeholder={defaultTenant}
                  className="font-mono text-sm"
                />
                <Input
                  label="User ID (optional)"
                  value={userIdIn}
                  onChange={(e) => setUserIdIn(e.target.value)}
                  placeholder="From registration or demo user id"
                  className="font-mono text-sm"
                />
              </>
            ) : null}
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
