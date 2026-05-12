import type { JsonValue } from "@/lib/types/models";

/** Deep-clone a value for JSON persistence (no `undefined` in nested objects). */
export function cloneJsonForPersistence(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/** JSON persistence should not store `undefined`; JSON cloning drops it from objects recursively. */
export function omitUndefinedForPersistence<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
