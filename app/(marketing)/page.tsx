import Image from "next/image";
import Link from "next/link";
import { BarChart3, Globe, MapPin, Network, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const trustLogos = ["VOLTA", "NEXUS", "QUANTUM", "VECTOR", "ORBIT"] as const;

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="text-[color:var(--color-text-primary)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--color-divider)] bg-[color:var(--color-shell)]/95 backdrop-blur-sm">
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
            Store OMS
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
            touchpoint of your supply chain with Store&apos;s high-density
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
          className="relative aspect-[4/3] w-full max-h-[min(420px,70vw)] justify-self-center overflow-hidden rounded-3xl bg-[color:var(--color-bg-subtle)] shadow-[var(--shadow-neo-raised-lg)] md:max-h-[480px] md:justify-self-stretch"
          aria-hidden
        >
          <Image
            src="https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1200&q=80"
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[color:var(--color-primary)]/35 via-transparent to-[color:var(--color-primary)]/15"
            aria-hidden
          />
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
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
                    Revenue performance
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
                    Daily operational volume vs projected growth
                  </p>
                </div>
                <div
                  className="flex rounded-lg bg-[color:var(--color-bg-subtle)] p-0.5 text-[11px] font-semibold shadow-[var(--shadow-neo-inset)]"
                  role="group"
                  aria-label="Chart range"
                >
                  <span className="rounded-md bg-[color:var(--color-shell)] px-2.5 py-1 text-[color:var(--color-primary)] shadow-sm">
                    24H
                  </span>
                  <span className="px-2.5 py-1 text-[color:var(--color-text-muted)]">
                    7D
                  </span>
                </div>
              </div>
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
                <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)] shadow-[var(--shadow-neo-raised-sm)]">
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
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 overflow-hidden rounded-2xl bg-[color:var(--color-text-primary)] px-8 py-12 text-[color:var(--color-shell)] shadow-[var(--shadow-neo-raised-lg)] md:flex-row md:items-center md:justify-between md:px-12">
          <span
            className="pointer-events-none absolute -end-8 top-1/2 -translate-y-1/2 select-none text-[min(12rem,28vw)] font-black leading-none text-white/[0.07]"
            aria-hidden
          >
            CT
          </span>
          <div className="relative max-w-xl space-y-2">
            <h2 className="text-2xl font-bold">Ready to optimize your operations?</h2>
            <p className="text-sm opacity-90">
              Join 200+ enterprise teams running Store for precision logistics
              and order orchestration.
            </p>
          </div>
          <div className="relative flex flex-wrap gap-3">
            <Link href="/login">
              <Button>Schedule Demo</Button>
            </Link>
            <Link href="mailto:sales@Store.example">
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

      <footer className="border-t border-[color:var(--color-divider)] bg-[color:var(--color-shell)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-semibold">Store OMS</p>
            <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
              © {new Date().getFullYear()} Store OMS. All rights reserved.
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
          <div className="flex items-center gap-1 text-[color:var(--color-text-muted)]">
            <a
              href="https://linkedin.com"
              className="rounded-lg p-2 hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-primary)]"
              aria-label="LinkedIn"
            >
              <LinkedInIcon className="size-4" />
            </a>
            <a
              href="https://twitter.com"
              className="rounded-lg p-2 hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-primary)]"
              aria-label="Twitter"
            >
              <XIcon className="size-4" />
            </a>
            <span className="rounded-lg p-2" title="Language" aria-hidden>
              <Globe className="size-4" />
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
