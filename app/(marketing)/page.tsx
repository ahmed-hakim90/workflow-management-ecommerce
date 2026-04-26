import Image from "next/image";
import Link from "next/link";
import { BarChart3, MapPin, Network, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const trustLogos = ["VOLTA", "NEXUS", "QUANTUM", "VECTOR", "ORBIT"] as const;

export default function LandingPage() {
  return (
    <div className="text-[color:var(--color-text-primary)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--color-divider)] bg-[color:var(--color-bg)]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold text-[color:var(--color-text-primary)]"
          >
            <Image
              src="/brand-mark.png"
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-xl shadow-[var(--shadow-neo-raised-sm)]"
              priority
            />
            Hakimo OMS
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[color:var(--color-text-secondary)] md:flex">
            <span className="cursor-default">Solutions</span>
            <span className="cursor-default">Platform</span>
            <span className="cursor-default">Analytics</span>
            <span className="cursor-default">Pricing</span>
            <span className="cursor-default">Resources</span>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-primary)] sm:inline"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="hidden text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-primary)] sm:inline"
            >
              Register
            </Link>
            <Link href="/login">
              <Button size="sm">Request Demo</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-14 md:grid-cols-2 md:items-center md:gap-16 md:px-6 lg:py-20">
        <div className="space-y-6">
          <span className="inline-flex rounded-full bg-[color:var(--color-primary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-primary-contrast)] shadow-[var(--shadow-neo-raised-sm)]">
            System v2.0 now live
          </span>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.75rem] lg:leading-tight">
            Mastering Order Management with Precision Logistics
          </h1>
          <p className="max-w-xl text-[color:var(--color-text-secondary)]">
            The silent partner for high-stakes logistics. Optimize every
            touchpoint of your supply chain with Hakimo&apos;s high-density
            operational intelligence.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login">
              <Button>Get Started Today</Button>
            </Link>
            <Link href="#preview">
              <Button variant="secondary" className="inline-flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-[color:var(--color-bg-subtle)] shadow-[var(--shadow-neo-inset)]">
                  <Play className="size-3 fill-current" aria-hidden />
                </span>
                Watch Overview
              </Button>
            </Link>
          </div>
        </div>
        <div
          className="relative flex min-h-[360px] items-center justify-center justify-self-stretch rounded-3xl bg-gradient-to-br from-[color:var(--color-primary)] via-[#1d4ed8] to-[#172554] p-6 shadow-[var(--shadow-neo-raised-lg)] md:min-h-[420px]"
          aria-hidden
        >
          <div className="relative w-full max-w-[340px] rounded-2xl bg-[color:var(--color-card)] p-5 text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-raised)] ring-1 ring-black/5">
            <div className="flex items-center gap-3 border-b border-[color:var(--color-divider)] pb-4">
              <Image
                src="/brand-mark.png"
                alt=""
                width={52}
                height={52}
                className="size-[52px] rounded-2xl shadow-[var(--shadow-neo-raised-sm)]"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Hakimo OMS</p>
                <p className="text-xs text-[color:var(--color-text-muted)]">
                  Live command center
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[color:var(--color-bg-subtle)] p-3 shadow-[var(--shadow-neo-inset)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                  Orders
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums">12.4k</p>
                <p className="text-[11px] font-medium text-[color:var(--color-success)]">
                  +8.2%
                </p>
              </div>
              <div className="rounded-xl bg-[color:var(--color-bg-subtle)] p-3 shadow-[var(--shadow-neo-inset)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                  Revenue
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums">$2.1M</p>
                <p className="text-[11px] font-medium text-[color:var(--color-success)]">
                  +3.1%
                </p>
              </div>
            </div>
            <div className="mt-3 h-24 rounded-xl bg-[color:var(--color-bg-subtle)] shadow-[var(--shadow-neo-inset)]">
              <div className="flex h-full items-end justify-between gap-1 px-3 pb-2 pt-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-full max-w-[9%] rounded-t-md bg-[color:var(--color-primary)]"
                    style={{
                      height: `${28 + ((i * 13) % 55)}%`,
                      opacity: 0.45 + (i % 5) * 0.1,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[color:var(--color-divider)] bg-[color:var(--color-bg-subtle)]/50 py-10">
        <div className="mx-auto max-w-6xl px-4 text-center md:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[color:var(--color-text-muted)]">
            Trusted by global logistics leaders
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 opacity-50">
            {trustLogos.map((name) => (
              <span
                key={name}
                className="text-sm font-bold tracking-tight text-[color:var(--color-text-secondary)]"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="preview" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            Real-time Operational Intelligence
          </h2>
          <p className="mt-2 text-[color:var(--color-text-secondary)]">
            Flagship financial and operational dashboards — daily volume,
            fulfillment health, and revenue performance in one place.
          </p>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardContent className="p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
                Revenue performance
              </p>
              <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
                Daily operational volume vs projected growth
              </p>
              <div className="mt-6 flex h-48 items-end justify-between gap-1 rounded-xl bg-[color:var(--color-bg-subtle)] px-4 py-3 shadow-[var(--shadow-neo-inset)]">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-full max-w-[8%] rounded-t-md bg-[color:var(--color-primary)] opacity-[0.35 + i * 0.05]"
                    style={{
                      height: `${30 + ((i * 17) % 65)}%`,
                      opacity: 0.35 + (i % 6) * 0.1,
                    }}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
                <span>
                  <span className="text-[color:var(--color-text-muted)]">
                    Total orders
                  </span>{" "}
                  <span className="font-semibold text-[color:var(--color-text-primary)]">
                    1,284,002
                  </span>
                </span>
                <span>
                  <span className="text-[color:var(--color-text-muted)]">
                    Fill rate
                  </span>{" "}
                  <span className="font-semibold text-[color:var(--color-primary)]">
                    99.4%
                  </span>
                </span>
                <Link
                  href="/analytics"
                  className="ms-auto font-medium text-[color:var(--color-primary)] hover:underline"
                >
                  Export CSV
                </Link>
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-4 lg:col-span-5">
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                  Avg fulfillment time
                </p>
                <p className="text-2xl font-bold">14.2m</p>
                <div className="h-2 rounded-full bg-[color:var(--color-bg-subtle)] shadow-[var(--shadow-neo-inset)]">
                  <div className="h-full w-[72%] rounded-full bg-[color:var(--color-primary)]" />
                </div>
                <p className="text-xs font-medium text-[color:var(--color-success)]">
                  +12.5%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                  In-transit volume
                </p>
                <p className="text-2xl font-bold">42.8k</p>
                <p className="text-xs text-[color:var(--color-text-secondary)]">
                  Distributed across 12 hubs
                </p>
                <span className="inline-flex w-fit rounded-full bg-[color:var(--color-muted-bg)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-primary)] shadow-[var(--shadow-neo-raised-sm)]">
                  Active now
                </span>
              </CardContent>
            </Card>
            <div className="rounded-2xl bg-[color:var(--color-primary)] p-5 text-[color:var(--color-primary-contrast)] shadow-[var(--shadow-neo-raised)]">
              <p className="font-semibold">Need deeper insights?</p>
              <p className="mt-1 text-sm opacity-90">
                Connect your custom API or ERP for enterprise-wide mapping.
              </p>
              <Link href="/login" className="mt-4 inline-block">
                <Button
                  variant="secondary"
                  className="border-0 bg-white/15 text-white shadow-[var(--shadow-neo-raised-sm)] hover:bg-white/25"
                >
                  Configure API
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              title: "Real-time Tracking",
              body: "Shipment accuracy and refresh frequency built for high-volume fulfillment teams.",
              icon: MapPin,
            },
            {
              title: "Smart Analytics",
              body: "Predictive signals and margin visibility to reduce overhead and stock-outs.",
              icon: BarChart3,
            },
            {
              title: "Seamless Integration",
              body: "Connect marketplaces, carriers, and ERPs without slowing down operators.",
              icon: Network,
            },
          ].map(({ title, body, icon: Icon }) => (
            <Card key={title}>
              <CardContent className="space-y-3 p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-text-primary)] text-[color:var(--color-bg)] shadow-[var(--shadow-neo-raised-sm)]">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm text-[color:var(--color-text-secondary)]">
                  {body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-4 mb-16 md:mx-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-2xl bg-[color:var(--color-text-primary)] px-8 py-12 text-[color:var(--color-bg)] shadow-[var(--shadow-neo-raised-lg)] md:flex-row md:items-center md:justify-between md:px-12">
          <div className="max-w-xl space-y-2">
            <h2 className="text-2xl font-bold">Ready to optimize your operations?</h2>
            <p className="text-sm opacity-90">
              Join 200+ enterprise teams running Hakimo for precision logistics
              and order orchestration.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/login">
              <Button>Schedule Demo</Button>
            </Link>
            <Link href="mailto:sales@hakimo.example">
              <Button
                variant="secondary"
                className="bg-transparent text-white shadow-[var(--shadow-neo-raised-sm)] ring-1 ring-white/30"
              >
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[color:var(--color-divider)] bg-[color:var(--color-card)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="font-semibold">Hakimo OMS</p>
            <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
              © {new Date().getFullYear()} Hakimo OMS. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-[color:var(--color-text-secondary)]">
            <span className="cursor-default">Privacy Policy</span>
            <span className="cursor-default">Terms of Service</span>
            <span className="cursor-default">Security</span>
            <span className="cursor-default">API Documentation</span>
            <Link href="/login" className="hover:text-[color:var(--color-primary)]">
              Contact Sales
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
