"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadSessionFromIdToken } from "@/lib/auth/client-session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/store/zustand/session-store";

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mockOn, setMockOn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dev/mock-status")
      .then((r) => r.json())
      .then((j: { enabled?: boolean }) => {
        if (!cancelled) setMockOn(!!j.enabled);
      })
      .catch(() => {
        if (!cancelled) setMockOn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canRegister = mockOn !== null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!companyName.trim() || !adminName.trim() || !email.trim()) {
      setErr("Fill in company, your name, and email.");
      return;
    }
    setBusy(true);
    try {
      if (mockOn) {
        const res = await fetch("/api/onboarding/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: companyName.trim(),
            adminName: adminName.trim(),
            email: email.trim(),
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          data?: {
            tenantId: string;
            userId: string;
            staffApiKey: string;
          };
          error?: string;
        };
        if (!res.ok || !json.data) {
          throw new Error(json.error ?? "Registration failed");
        }
        setSession({
          idToken: "",
          apiSecret: json.data.staffApiKey,
          tenantId: json.data.tenantId,
          userId: json.data.userId,
          displayName: adminName.trim(),
          tenantName: companyName.trim(),
          role: "admin",
        });
        router.push("/analytics");
        return;
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      const res = await fetch("/api/onboarding/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          adminName: adminName.trim(),
          email: email.trim(),
          password,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { staffApiKey: string };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Registration failed");
      }
      const supabase = createSupabaseBrowserClient();
      const signedIn = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signedIn.error || !signedIn.data.session?.access_token) {
        throw new Error(signedIn.error?.message ?? "Could not sign in");
      }
      await loadSessionFromIdToken(signedIn.data.session.access_token, setSession);
      if (json.data?.staffApiKey && typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "Store-staff-api-key-hint",
          `Your tenant staff API key (save it): ${json.data.staffApiKey}`,
        );
      }
      router.push("/analytics");
    } catch (unknown) {
      const msg =
        unknown instanceof Error ? unknown.message : "Registration failed";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-gradient-to-br from-[color:var(--color-primary)]/20 via-[color:var(--color-bg)] to-[color:var(--color-bg-subtle)] p-10 md:flex">
        <Link href="/" className="text-lg font-semibold text-[color:var(--color-text-primary)]">
          Store OMS
        </Link>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">
            Register your company
          </h1>
          <p className="max-w-md text-[color:var(--color-text-secondary)]">
            Create a tenant, get your WooCommerce webhook URL, and invite your
            team. Bosta and other carriers are configured per company in
            Settings.
          </p>
        </div>
        <p className="text-xs text-[color:var(--color-text-muted)]">
          © {new Date().getFullYear()} Store OMS
        </p>
      </div>
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[var(--ds-radius-md)] bg-[color:var(--color-card)] p-8 shadow-none md:p-10">
          <h2 className="text-xl font-semibold">Create account</h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            {mockOn
              ? "Mock mode: no Supabase needed. After signup you are signed in automatically; save the staff API key for API scripts."
              : "Creates a Supabase Auth user and your company tenant."}
          </p>
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="mt-6 space-y-4"
          >
            <Input
              label="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Trading"
              autoComplete="organization"
            />
            <Input
              label="Your name"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
            />
            <Input
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
            {!mockOn ? (
              <Input
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            ) : null}
            {err ? (
              <p className="text-sm text-[color:var(--color-error)]">{err}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy || !canRegister}>
              {busy ? "Creating…" : "Create company"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-[color:var(--color-text-muted)]">
            Already have access?{" "}
            <Link
              href="/login"
              className="font-medium text-[color:var(--color-primary)] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
