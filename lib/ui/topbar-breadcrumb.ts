import type { BreadcrumbSegment } from "@/components/layout/app-breadcrumb";

/** Maps path segments to `t()` dictionary keys (English source strings). */
const SEGMENT_TO_I18N: Record<string, string> = {
  analytics: "Analytics",
  orders: "Orders",
  shipments: "Shipments",
  tickets: "Tickets",
  inbox: "Inbox",
  warehouse: "Warehouse",
  admin: "Admin",
  users: "Users",
  settings: "Settings",
  dashboard: "Dashboard",
  kanban: "Board",
  register: "Register",
  login: "Sign in",
  packages: "Packages",
  "super-admin": "Super Admin",
  offline: "Offline",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function shortId(segment: string) {
  if (segment.length <= 14) return segment;
  return `${segment.slice(0, 8)}…`;
}

function titleCaseSegment(segment: string) {
  return segment
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Builds breadcrumb segments from the current pathname for the app top bar.
 */
export function pathnameToTopbarBreadcrumbs(
  pathname: string,
  t: (source: string) => string,
): BreadcrumbSegment[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [];

  const out: BreadcrumbSegment[] = [];
  let hrefAcc = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    hrefAcc += `/${part}`;
    const last = i === parts.length - 1;

    const i18nKey = SEGMENT_TO_I18N[part];
    let label: string;
    if (i18nKey) {
      label = t(i18nKey);
    } else if (UUID_RE.test(part)) {
      label = shortId(part);
    } else if (/^[0-9a-f-]{10,}$/i.test(part) && part.includes("-")) {
      label = shortId(part);
    } else if (part.length >= 24 && /^[a-z0-9]+$/i.test(part)) {
      label = shortId(part);
    } else {
      label = titleCaseSegment(part);
    }

    out.push({
      label,
      href: last ? undefined : hrefAcc,
    });
  }

  return out;
}
