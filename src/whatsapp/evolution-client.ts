import type { HttpPort } from "./http-port";
import { asArray, asNumber, asObject, asString } from "../shared/json";
import { type Chat, type ChatMessage, parseChat, parseMessage } from "./messages";

export interface EvolutionConfig {
  baseUrl: string;
  instance: string;
  apiKey: string;
}

export interface OutgoingImage {
  base64: string;
  mimetype: string;
  fileName: string;
  caption?: string;
}

export class EvolutionError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EvolutionError";
  }
}

const PAGE_SIZE = 50;

/** REST client for Evolution API v2 (verified against 2.3.7). */
export class EvolutionClient {
  constructor(
    private readonly http: HttpPort,
    private readonly config: () => EvolutionConfig,
  ) {}

  async connectionState(): Promise<string> {
    const json = await this.call("GET", "instance/connectionState");
    return asString(asObject(asObject(json).instance).state) ?? "unknown";
  }

  async findChats(): Promise<Chat[]> {
    const json = await this.call("POST", "chat/findChats", {});
    return asArray(json)
      .map(parseChat)
      .filter((c): c is Chat => c !== null);
  }

  /** Page 1 holds the newest messages; each page is returned oldest first. */
  async findMessages(jid: string, page = 1): Promise<{ messages: ChatMessage[]; pages: number }> {
    const json = await this.call("POST", "chat/findMessages", {
      where: { key: { remoteJid: jid } },
      page,
      offset: PAGE_SIZE,
    });
    const messages = asObject(asObject(json).messages);
    return {
      messages: asArray(messages.records).map(parseMessage).sort((a, b) => a.timestamp - b.timestamp),
      pages: asNumber(messages.pages) || 1,
    };
  }

  async sendText(jid: string, text: string): Promise<void> {
    await this.call("POST", "message/sendText", { number: jid, text });
  }

  async sendImage(jid: string, image: OutgoingImage): Promise<void> {
    await this.call("POST", "message/sendMedia", {
      number: jid,
      mediatype: "image",
      mimetype: image.mimetype,
      fileName: image.fileName,
      caption: image.caption ?? "",
      media: image.base64,
    });
  }

  async mediaBase64(messageId: string): Promise<{ base64: string; mimetype: string }> {
    const json = asObject(
      await this.call("POST", "chat/getBase64FromMediaMessage", {
        message: { key: { id: messageId } },
        convertToMp4: false,
      }),
    );
    const base64 = asString(json.base64);
    if (!base64) throw new EvolutionError("El servidor no devolvió la imagen");
    return { base64, mimetype: asString(json.mimetype) ?? "image/jpeg" };
  }

  private async call(method: "GET" | "POST", route: string, body?: unknown): Promise<unknown> {
    const { baseUrl, instance, apiKey } = this.config();
    if (!baseUrl.trim() || !instance.trim() || !apiKey.trim()) {
      throw new EvolutionError("Configurá la URL, la instancia y la API key de Evolution API");
    }
    const url = `${baseUrl.trim().replace(/\/+$/, "")}/${route}/${encodeURIComponent(instance.trim())}`;
    const response = await this.http.request({ method, url, headers: { apikey: apiKey.trim() }, body });
    if (response.status < 200 || response.status >= 300) {
      throw new EvolutionError(`Evolution API respondió ${response.status}: ${errorDetail(response.json)}`, response.status);
    }
    return response.json;
  }
}

function errorDetail(json: unknown): string {
  const data = asObject(json);
  const message = asObject(data.response).message ?? data.message ?? data.error;
  if (Array.isArray(message)) return message.map((m) => (typeof m === "string" ? m : JSON.stringify(m))).join(", ");
  return typeof message === "string" && message ? message : "error desconocido";
}
