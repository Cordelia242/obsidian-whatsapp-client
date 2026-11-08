/** Narrowing helpers for JSON coming from the network (typed as `unknown`). */
export type JsonObject = Record<string, unknown>;

export function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Text of a scalar property value (string, number, boolean); "" for anything else. */
export function scalarText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function asNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(asString(value) ?? NaN);
  return Number.isFinite(number) ? number : 0;
}
