import type { JsonValue } from "@/lib/types/models";

/** Deep-clone a value for Firestore (no `undefined` in nested objects). */
export function cloneJsonForFirestore(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/** Firestore rejects `undefined`; JSON cloning drops it from objects recursively. */
export function omitUndefinedForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
