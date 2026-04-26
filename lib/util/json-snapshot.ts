import type { JsonValue } from "@/lib/types/models";

/** Deep-clone a value for Firestore (no `undefined` in nested objects). */
export function cloneJsonForFirestore(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
