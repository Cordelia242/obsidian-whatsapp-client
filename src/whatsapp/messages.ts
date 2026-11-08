import { phoneFromJid } from "../customers/phone";
import { asNumber, asObject, asString } from "../shared/json";

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

export function parseMessage(raw: unknown): ChatMessage {
  const record = asObject(raw);
  const key = asObject(record.key);
  const message = asObject(record.message);
  const base = {
    id: asString(key.id) ?? "",
    jid: asString(key.remoteJid) ?? "",
    fromMe: key.fromMe === true,
    timestamp: asNumber(record.messageTimestamp) * 1000,
    pushName: asString(record.pushName),
    altJid: asString(key.remoteJidAlt),
  };

  const text = asString(message.conversation) ?? asString(asObject(message.extendedTextMessage).text);
  if (text !== undefined) return { ...base, kind: "text", text };

  if (message.imageMessage) {
    return { ...base, kind: "image", caption: asString(asObject(message.imageMessage).caption) || undefined };
  }

  const type = Object.keys(message).find((k) => k in OTHER_LABELS);
  return { ...base, kind: "other", label: type ? OTHER_LABELS[type] : "Mensaje" };
}

export function parseChat(raw: unknown): Chat | null {
  const record = asObject(raw);
  const jid = asString(record.remoteJid) ?? "";
  if (!jid || jid === "status@broadcast") return null;
  const updatedAtText = asString(record.updatedAt);
  const updatedAt = updatedAtText ? Date.parse(updatedAtText) : 0;
  const lastMessage = record.lastMessage ? parseMessage(record.lastMessage) : undefined;
  const contactName = lastMessage && !lastMessage.fromMe ? lastMessage.pushName : undefined;
  return {
    jid,
    phone: phoneOfChat(jid, lastMessage ? [lastMessage] : []),
    lid: jid.endsWith("@lid") ? jid : undefined,
    name: asString(record.pushName) || contactName || jid.split("@")[0]!,
    profilePicUrl: asString(record.profilePicUrl) || undefined,
    updatedAt: Number.isNaN(updatedAt) ? 0 : updatedAt,
    unreadCount: asNumber(record.unreadCount),
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
