import { scalarText } from "./json";

/** Wraps a note name in a wikilink, as the vault stores relations: `[[Santa Cruz]]`. */
export function link(name: string): string {
  return `[[${name}]]`;
}

/** Inverse of `link`: `[[Santa Cruz|SCZ]]` → `Santa Cruz`. Plain values are returned trimmed. */
export function unlink(value: unknown): string {
  return scalarText(value)
    .replace(/^\[\[|\]\]$/g, "")
    .split("|")[0]!
    .trim();
}

/** Removes characters Obsidian does not allow in file names and collapses spaces. */
export function sanitizeBasename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|#^[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Local date as YYYY-MM-DD, the format of every `fecha` property in the vault. */
export function isoDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Numeric text becomes a number (as Templater wrote it into YAML); anything else stays text. */
export function numberOrText(value: string | number | undefined): number | string {
  const text = String(value ?? "").trim();
  return text !== "" && Number.isFinite(Number(text)) ? Number(text) : text;
}

export function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
