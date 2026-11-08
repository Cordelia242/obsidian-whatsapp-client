/**
 * Phone numbers are compared in international digits-only form ("59170000001").
 * The vault stores them as typed (usually local, "70000001"); WhatsApp JIDs carry them
 * international ("59170000001@s.whatsapp.net").
 */
import { scalarText } from "../shared/json";

const LOCAL_MAX_DIGITS = 8;

export function normalizePhone(raw: unknown, countryCode: string): string | null {
  let digits = scalarText(raw).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return null;
  return digits.length <= LOCAL_MAX_DIGITS ? `${countryCode}${digits}` : digits;
}

/** Number behind a personal chat JID; null for groups, broadcasts and LID addresses. */
export function phoneFromJid(jid: string): string | null {
  const [user, server] = jid.split("@");
  if (server !== "s.whatsapp.net" || !user) return null;
  const digits = user.split(":")[0]!;
  return /^\d+$/.test(digits) ? digits : null;
}

/** Form used when writing a phone into the vault: local for the default country, "+…" otherwise. */
export function localPhone(international: string, countryCode: string): string {
  return international.startsWith(countryCode) && international.length > countryCode.length + 6
    ? international.slice(countryCode.length)
    : `+${international}`;
}
