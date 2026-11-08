import { phoneFromJid } from "../customers/phone";

/** A WhatsApp message reduced to what the chat view shows. */
export interface ChatMessage {
  id: string;
  jid: string;
  fromMe: boolean;
  /** Milliseconds since epoch. */
  timestamp: number;
  pushName?: string;
  kind: "text" | "image" | "other";
  text?: string;
  caption?: string;
  /** Short label for unsupported types, e.g. "Audio". */
  label?: string;
  /** Phone JID WhatsApp sends alongside a LID address (`key.remoteJidAlt`), when known. */
  altJid?: string;
}

export interface Chat {
  jid: string;
  /** International digits, or null when WhatsApp hides the number (LID without alternative, groups). */
  phone: string | null;
  /** The chat's LID address ("…@lid"), when WhatsApp identifies it that way. */
  lid?: string;
  name: string;
  profilePicUrl?: string;
  /** Milliseconds since epoch, 0 when unknown. */
  updatedAt: number;
  unreadCount: number;
  lastMessage?: ChatMessage;
}

const OTHER_LABELS: Record<string, string> = {
  audioMessage: "Audio",
  videoMessage: "Video",
  documentMessage: "Documento",
  documentWithCaptionMessage: "Documento",
  stickerMessage: "Sticker",
  locationMessage: "Ubicación",
  contactMessage: "Contacto",
  reactionMessage: "Reacción",
};

type Json = Record<string, any>;

export function parseMessage(record: Json): ChatMessage {
  const key: Json = record.key ?? {};
  const message: Json = record.message ?? {};
  const base = {
    id: String(key.id ?? ""),
    jid: String(key.remoteJid ?? ""),
    fromMe: Boolean(key.fromMe),
    timestamp: Number(record.messageTimestamp ?? 0) * 1000,
    pushName: record.pushName ?? undefined,
    altJid: typeof key.remoteJidAlt === "string" ? key.remoteJidAlt : undefined,
  };

  const text = message.conversation ?? message.extendedTextMessage?.text;
  if (typeof text === "string") return { ...base, kind: "text", text };

  if (message.imageMessage) {
    return { ...base, kind: "image", caption: message.imageMessage.caption || undefined };
  }

  const type = Object.keys(message).find((k) => k in OTHER_LABELS);
  return { ...base, kind: "other", label: type ? OTHER_LABELS[type] : "Mensaje" };
}

export function parseChat(record: Json): Chat | null {
  const jid = String(record.remoteJid ?? "");
  if (!jid || jid === "status@broadcast") return null;
  const updatedAt = record.updatedAt ? Date.parse(record.updatedAt) : 0;
  const lastMessage = record.lastMessage ? parseMessage(record.lastMessage) : undefined;
  const contactName = lastMessage && !lastMessage.fromMe ? lastMessage.pushName : undefined;
  return {
    jid,
    phone: phoneOfChat(jid, lastMessage ? [lastMessage] : []),
    lid: jid.endsWith("@lid") ? jid : undefined,
    name: record.pushName || contactName || jid.split("@")[0]!,
    profilePicUrl: record.profilePicUrl || undefined,
    updatedAt: Number.isNaN(updatedAt) ? 0 : updatedAt,
    unreadCount: Number(record.unreadCount ?? 0),
    lastMessage,
  };
}

/** Phone of a chat: from its JID, or from the `remoteJidAlt` of any of its messages (LID chats). */
export function phoneOfChat(jid: string, messages: ChatMessage[]): string | null {
  const direct = phoneFromJid(jid);
  if (direct) return direct;
  for (const message of messages) {
    const alt = message.altJid ? phoneFromJid(message.altJid) : null;
    if (alt) return alt;
  }
  return null;
}

/** One-line preview for the chat list. */
export function previewOf(message: ChatMessage | undefined): string {
  if (!message) return "";
  if (message.kind === "text") return message.text ?? "";
  if (message.kind === "image") return message.caption ? `📷 ${message.caption}` : "📷 Imagen";
  return `[${message.label}]`;
}
