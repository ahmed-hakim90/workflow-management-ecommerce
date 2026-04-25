import { jsonError } from "@/lib/http/json";
import { AuthError } from "@/lib/auth/context";
import { ZodError } from "zod";

export function handleRouteError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError(err.message, err.status);
  }
  if (err instanceof ZodError) {
    return jsonError(err.message, 422);
  }
  if (err instanceof Error) {
    const status = (err as Error & { status?: number }).status;
    if (status === 403) return jsonError(err.message, 403);
    return jsonError(err.message, 400);
  }
  return jsonError("Internal error", 500);
}
