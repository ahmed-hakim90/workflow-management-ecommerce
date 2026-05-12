import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquareText,
  Network,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Truck,
  Warehouse,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";

const trustLogos = ["WooCommerce", "Bosta", "WhatsApp", "Supabase", "Analytics"] as const;

const heroMetrics = [
  { label: "Orders synced", value: "1.2M+", detail: "Across stores and channels" },
  { label: "Fulfillment SLA", value: "99.4%", detail: "Tracked from order to delivery" },
  { label: "Team response", value: "14m", detail: "Average handling time" },
] as const;

const platformStats = [
  { label: "New orders", value: "384", trend: "+18%" },
  { label: "Ready to ship", value: "126", trend: "Live" },
  { label: "Open tickets", value: "23", trend: "-9%" },
] as const;

const benefits: {
  title: string;
  body: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Order Command Center",
    body: "Unify WooCommerce orders, customer notes, confirmation status, invoices, and warehouse handoff in one operating view.",
    icon: PackageCheck,
  },
  {
    title: "Shipment Visibility",
    body: "Track active deliveries, shipping exceptions, and hub movement before they become support escalations.",
    icon: Truck,
  },
  {
    title: "Role-based Operations",
    body: "Give confirmation, warehouse, invoicing, support, and admins the exact workspace they need.",
    icon: ShieldCheck,
  },
];

const workflowSteps = [
  {
    title: "Capture",
    body: "Orders arrive from your storefront with customer, product, and payment context ready for action.",
  },
  {
    title: "Confirm",
    body: "Teams validate customer intent, share WhatsApp follow-ups, and resolve missing details quickly.",
  },
  {
    title: "Fulfill",
    body: "Warehouse and shipment teams move confirmed orders through packing, invoicing, and carrier pickup.",
  },
  {
    title: "Optimize",
    body: "Analytics surface bottlenecks, delivery risk, revenue trends, and team performance in real time.",
  },
] as const;

const integrations = [
  { name: "WooCommerce", description: "Order webhooks and catalog context" },
  { name: "Bosta", description: "Shipment creation and tracking" },
  { name: "WhatsApp", description: "Confirmation and customer updates" },
  { name: "Supabase", description: "Auth, app data, and operational state" },
] as const;

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
    <div className="overflow-hidden text-[color:var(--color-text-primary)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--color-divider)] bg-[color:var(--color-shell)]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold text-[color:var(--color-text-primary)]"
          >
            <span className="flex size-9 items-center justify-center rounded-[var(--ds-radius-md)] bg-[color:var(--color-primary)] text-sm font-black text-[color:var(--color-primary-contrast)] shadow-none">
              S
            </span>
            Store OMS
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[color:var(--color-text-secondary)] md:flex">
            <Link href="#platform" className="hover:text-[color:var(--color-primary)]">
              Platform
            </Link>
            <Link href="#workflow" className="hover:text-[color:var(--color-primary)]">
              Workflow
            </Link>
            <Link href="#integrations" className="hover:text-[color:var(--color-primary)]">
              Integrations
            </Link>
            <Link href="#analytics" className="hover:text-[color:var(--color-primary)]">
              Analytics
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle className="hidden sm:inline-flex" />
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

      <section className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_top_left,_color-mix(in_srgb,var(--color-primary)_22%,transparent),_transparent_35%),linear-gradient(180deg,var(--color-shell),var(--color-bg))]"
          aria-hidden
        />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.02fr_0.98fr] md:items-center md:gap-14 md:px-6 lg:py-20">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-1 text-[11px] font-medium text-[color:var(--color-primary)] shadow-none">
              <Sparkles className="size-3.5" aria-hidden />
              Built for fast-moving ecommerce teams
            </span>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl lg:text-[3.35rem] lg:leading-[1.05]">
                Run orders, confirmations, shipping, and support from one
                control room.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[color:var(--color-text-secondary)] md:text-lg">
                Store OMS gives operations teams a shared workspace for
                high-volume order management, live fulfillment visibility, and
                the signals needed to remove delays before customers feel them.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/login">
                <Button size="lg" className="group">
                  Start managing orders
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Button>
              </Link>
              <Link href="#platform">
                <Button variant="secondary" size="lg">
                  Explore platform
                </Button>
              </Link>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              {heroMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-none"
                >
                  <p className="text-2xl font-bold text-[color:var(--color-primary)]">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-[12px] font-medium text-[color:var(--color-text-muted)]">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                    {metric.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div
              className="absolute -right-10 -top-10 size-44 rounded-full bg-[color:var(--color-primary)]/10 blur-3xl"
              aria-hidden
            />
            <Card className="relative overflow-hidden rounded-[var(--ds-radius-lg)]">
              <CardContent className="p-4 md:p-5">
                <div className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                        Operations pulse
                      </p>
                      <h2 className="mt-1 text-xl font-bold">Today&apos;s command view</h2>
                    </div>
                    <span className="rounded-full bg-[color:var(--color-callout-success-bg)] px-3 py-1 text-xs font-semibold text-[color:var(--color-callout-success-text)]">
                      Live
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {platformStats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-3 shadow-none"
                      >
                        <p className="text-xs text-[color:var(--color-text-muted)]">
                          {stat.label}
                        </p>
                        <div className="mt-2 flex items-end justify-between gap-2">
                          <span className="text-2xl font-bold">{stat.value}</span>
                          <span className="text-xs font-semibold text-[color:var(--color-success)]">
                            {stat.trend}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-none">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                          Fulfillment throughput
                        </p>
                        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
                          Confirmed orders moving to warehouse
                        </p>
                      </div>
                      <Clock3 className="size-5 text-[color:var(--color-primary)]" aria-hidden />
                    </div>
                    <div className="mt-6 flex h-44 items-end justify-between gap-1 rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] px-4 py-3">
                      {[42, 56, 38, 64, 70, 52, 78, 74, 88, 68, 82, 92].map((height, index) => (
                        <div
                          key={`${height}-${index}`}
                          className="w-full max-w-[8%] rounded-t-md bg-[color:var(--color-primary)]"
                          style={{
                            height: `${height}%`,
                            opacity: 0.36 + (index % 6) * 0.09,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary)] p-4 text-[color:var(--color-primary-contrast)] shadow-none">
                      <p className="text-[12px] font-medium opacity-90">
                        At risk
                      </p>
                      <p className="mt-2 text-2xl font-bold">8 orders</p>
                      <p className="mt-1 text-xs opacity-85">
                        Missing address or customer confirmation.
                      </p>
                    </div>
                    <div className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-none">
                      <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                        Next action
                      </p>
                      <p className="mt-2 font-semibold">Notify confirmation team</p>
                      <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
                        WhatsApp follow-up ready for queued orders.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-y border-[color:var(--color-divider)] bg-[color:var(--color-bg-subtle)]/50 py-10">
        <div className="mx-auto max-w-6xl px-4 text-center md:px-6">
          <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
            Connect the systems your operations already use
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 opacity-70">
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

      <section id="platform" className="mx-auto max-w-6xl px-4 py-16 md:px-6 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[12px] font-semibold text-[color:var(--color-primary)]">
            Platform
          </span>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">
            One workspace for the full order lifecycle.
          </h2>
          <p className="mt-3 text-[color:var(--color-text-secondary)]">
            Replace scattered spreadsheets and chat handoffs with a system that
            reflects how ecommerce operations actually move.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {benefits.map(({ title, body, icon: Icon }) => (
            <Card key={title} className="group transition-transform hover:-translate-y-1">
              <CardContent className="space-y-4 p-6">
                <div className="flex size-12 items-center justify-center rounded-[var(--ds-radius-md)] bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)] shadow-none">
                  <Icon className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--color-text-secondary)]">
                    {body}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-primary)]">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Ready for daily operations
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="workflow" className="bg-[color:var(--color-bg)] py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="space-y-4">
              <span className="text-[12px] font-semibold text-[color:var(--color-primary)]">
                Workflow
              </span>
              <h2 className="text-3xl font-bold md:text-4xl">
                A cleaner flow from checkout to delivery.
              </h2>
              <p className="text-[color:var(--color-text-secondary)]">
                Store OMS keeps every team aligned around the same operational
                truth: what needs confirmation, what is ready to pick, what is
                delayed, and what needs customer support.
              </p>
              <Link href="/login" className="inline-block">
                <Button variant="secondary">
                  See the dashboard
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {workflowSteps.map((step, index) => (
                <Card key={step.title}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] text-sm font-bold text-[color:var(--color-primary)]">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="font-semibold">{step.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--color-text-secondary)]">
                          {step.body}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="analytics" className="mx-auto max-w-6xl px-4 py-16 md:px-6 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <Card className="lg:col-span-7">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                    Revenue and fulfillment performance
                  </p>
                  <h2 className="mt-2 text-2xl font-bold md:text-3xl">
                    Spot bottlenecks before they cost revenue.
                  </h2>
                </div>
                <div
                  className="flex rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-0.5 text-[11px] font-semibold"
                  role="group"
                  aria-label="Chart range"
                >
                  <span className="rounded-md bg-[color:var(--color-shell)] px-2.5 py-1 text-[color:var(--color-primary)] shadow-sm">
                    24H
                  </span>
                  <span className="px-2.5 py-1 text-[color:var(--color-text-muted)]">
                    7D
                  </span>
                  <span className="px-2.5 py-1 text-[color:var(--color-text-muted)]">
                    30D
                  </span>
                </div>
              </div>
              <div className="mt-6 flex h-56 items-end justify-between gap-1 rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] px-4 py-3">
                {[48, 66, 54, 72, 58, 81, 75, 88, 70, 94, 86, 98].map((height, index) => (
                  <div
                    key={`${height}-${index}`}
                    className="w-full max-w-[8%] rounded-t-md bg-[color:var(--color-primary)]"
                    style={{
                      height: `${height}%`,
                      opacity: 0.34 + (index % 6) * 0.1,
                    }}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
                <span>
                  <span className="text-[color:var(--color-text-muted)]">
                    Confirmed orders
                  </span>{" "}
                  <span className="font-semibold text-[color:var(--color-text-primary)]">
                    18,420
                  </span>
                </span>
                <span>
                  <span className="text-[color:var(--color-text-muted)]">
                    Delivery health
                  </span>{" "}
                  <span className="font-semibold text-[color:var(--color-primary)]">
                    96.8%
                  </span>
                </span>
                <Link
                  href="/analytics"
                  className="ms-auto font-medium text-[color:var(--color-primary)] hover:underline"
                >
                  Open analytics
                </Link>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-4 lg:col-span-5">
            {[
              {
                title: "Shipment accuracy",
                body: "Monitor dispatch, in-transit volume, failed attempts, and delivery exceptions.",
                icon: MapPin,
              },
              {
                title: "Team productivity",
                body: "See confirmation speed, ticket load, warehouse queue depth, and invoicing progress.",
                icon: BarChart3,
              },
              {
                title: "Automation signals",
                body: "Use operational thresholds to route work and reduce repeated manual checks.",
                icon: Workflow,
              },
            ].map(({ title, body, icon: Icon }) => (
              <Card key={title}>
                <CardContent className="flex gap-4 p-5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--ds-radius-md)] bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)] shadow-none">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--color-text-secondary)]">
                      {body}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="integrations" className="bg-[color:var(--color-bg-subtle)]/60 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <span className="text-[12px] font-semibold text-[color:var(--color-primary)]">
                Integrations
              </span>
              <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                Keep storefront, carrier, and customer updates in sync.
              </h2>
              <p className="mt-3 text-[color:var(--color-text-secondary)]">
                The landing page now reflects the systems already present in
                the product: storefront webhooks, shipping providers, WhatsApp
                confirmation, and secure team access.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {integrations.map((integration) => (
                <Card key={integration.name}>
                  <CardContent className="p-5">
                    <div className="mb-4 flex size-10 items-center justify-center rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)]">
                      {integration.name === "WooCommerce" ? (
                        <Warehouse className="size-5 text-[color:var(--color-primary)]" aria-hidden />
                      ) : integration.name === "Bosta" ? (
                        <Truck className="size-5 text-[color:var(--color-primary)]" aria-hidden />
                      ) : integration.name === "WhatsApp" ? (
                        <MessageSquareText className="size-5 text-[color:var(--color-primary)]" aria-hidden />
                      ) : (
                        <Network className="size-5 text-[color:var(--color-primary)]" aria-hidden />
                      )}
                    </div>
                    <h3 className="font-semibold">{integration.name}</h3>
                    <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
                      {integration.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-4 mb-16 md:mx-6">
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 overflow-hidden rounded-[var(--ds-radius-md)] bg-[color:var(--color-text-primary)] px-8 py-12 text-[color:var(--color-shell)] shadow-none md:flex-row md:items-center md:justify-between md:px-12">
          <span
            className="pointer-events-none absolute -end-8 top-1/2 -translate-y-1/2 select-none text-[min(12rem,28vw)] font-black leading-none text-white/[0.07]"
            aria-hidden
          >
            OMS
          </span>
          <div className="relative max-w-xl space-y-2">
            <h2 className="text-2xl font-bold">
              Ready to turn order chaos into a clear operating rhythm?
            </h2>
            <p className="text-sm opacity-90">
              Give every team a reliable source of truth for orders,
              confirmations, shipping, support, and analytics.
            </p>
          </div>
          <div className="relative flex flex-wrap gap-3">
            <Link href="/login">
              <Button>Schedule Demo</Button>
            </Link>
            <Link href="/register">
              <Button
                variant="secondary"
                className="bg-transparent text-white shadow-none ring-1 ring-white/30"
              >
                Create Account
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
              © {new Date().getFullYear()} Store OMS. Built for high-volume
              ecommerce operations.
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
              className="rounded-[var(--ds-radius-md)] p-2 hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-primary)]"
              aria-label="LinkedIn"
            >
              <LinkedInIcon className="size-4" />
            </a>
            <a
              href="https://twitter.com"
              className="rounded-[var(--ds-radius-md)] p-2 hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-primary)]"
              aria-label="Twitter"
            >
              <XIcon className="size-4" />
            </a>
            <LanguageToggle className="shadow-none" />
          </div>
        </div>
      </footer>
    </div>
  );
}
