import { getServerEnv } from "@/lib/config/env";
import { runGlobalInboxSlaCron } from "@/lib/services/chat/conversation-sla.service";

export const runtime = "nodejs";

function assertCronAuth(req: Request): Response | null {
  const secret = getServerEnv().CRON_SECRET?.trim();
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !secret) {
    return new Response("CRON_SECRET not configured", { status: 503 });
  }
  if (secret) {
    const auth = req.headers.get("authorization")?.trim();
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }
  return null;
}

export async function GET(req: Request) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  const result = await runGlobalInboxSlaCron();
  return Response.json({ ok: true, ...result });
}

/** Same body as GET — for providers that prefer POST. */
export async function POST(req: Request) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  const result = await runGlobalInboxSlaCron();
  return Response.json({ ok: true, ...result });
}
