import type { Chat } from "./messages";

export type ChatFilter = "all" | "customers" | "unknown";

/** Chat list search (name ignoring accents, or phone digits) plus the customer filter chips. */
export function filterChats(chats: Chat[], query: string, filter: ChatFilter, isCustomer: (chat: Chat) => boolean): Chat[] {
  const text = fold(query);
  const digits = query.replace(/\D/g, "");
  return chats.filter((chat) => {
    if (filter === "customers" && !isCustomer(chat)) return false;
    if (filter === "unknown" && (isCustomer(chat) || (!chat.phone && !chat.lid))) return false;
    if (!text) return true;
    return fold(chat.name).includes(text) || (digits.length > 0 && (chat.phone ?? chat.jid.split("@")[0]!).includes(digits));
  });
}

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function imageMimetype(extension: string): string | null {
  return IMAGE_TYPES[extension.toLowerCase()] ?? null;
}

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
