import { NextResponse } from "next/server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";

export async function GET() {
  return NextResponse.json({ enabled: isDevMockDataEnabled() });
}
