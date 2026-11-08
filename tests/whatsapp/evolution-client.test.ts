import { beforeEach, describe, expect, it } from "vitest";
import { EvolutionClient, EvolutionError } from "../../src/whatsapp/evolution-client";
import type { HttpPort, HttpRequest, HttpResponse } from "../../src/whatsapp/http-port";

class FakeHttp implements HttpPort {
  requests: HttpRequest[] = [];
  responses: HttpResponse[] = [];

  async request(req: HttpRequest): Promise<HttpResponse> {
    this.requests.push(req);
    return this.responses.shift() ?? { status: 200, json: {} };
  }
}

describe("EvolutionClient", () => {
  let http: FakeHttp;
  let client: EvolutionClient;

  beforeEach(() => {
    http = new FakeHttp();
    client = new EvolutionClient(http, () => ({
      baseUrl: "https://evo.example.com/",
      instance: "shop",
      apiKey: "secret",
    }));
  });

  it("authenticates every request with the apikey header", async () => {
    http.responses.push({ status: 200, json: { instance: { instanceName: "shop", state: "open" } } });
    expect(await client.connectionState()).toBe("open");
    expect(http.requests[0]).toMatchObject({
      method: "GET",
      url: "https://evo.example.com/instance/connectionState/shop",
      headers: { apikey: "secret" },
    });
  });

  it("maps chats, skipping status broadcasts", async () => {
    http.responses.push({
      status: 200,
      json: [
        {
          remoteJid: "59171234567@s.whatsapp.net",
          pushName: "María Fernanda",
          profilePicUrl: null,
          updatedAt: "2026-11-08T18:32:00.000Z",
          unreadCount: 2,
          lastMessage: {
            key: { id: "A1", fromMe: false, remoteJid: "59171234567@s.whatsapp.net" },
            messageType: "conversation",
            message: { conversation: "¿Todavía tenés la coreana C50?" },
            messageTimestamp: 1794162720,
          },
        },
        { remoteJid: "status@broadcast", pushName: null, updatedAt: null, unreadCount: 0 },
      ],
    });

    const chats = await client.findChats();

    expect(http.requests[0]).toMatchObject({ method: "POST", url: "https://evo.example.com/chat/findChats/shop" });
    expect(chats).toEqual([
      {
        jid: "59171234567@s.whatsapp.net",
        phone: "59171234567",
        lid: undefined,
        name: "María Fernanda",
        profilePicUrl: undefined,
        updatedAt: Date.parse("2026-11-08T18:32:00.000Z"),
        unreadCount: 2,
        lastMessage: expect.objectContaining({ id: "A1", kind: "text", text: "¿Todavía tenés la coreana C50?" }),
      },
    ]);
  });

  it("resolves the phone and name of LID chats from the last message", async () => {
    http.responses.push({
      status: 200,
      json: [
        {
          remoteJid: "100000000000001@lid",
          pushName: null,
          updatedAt: "2026-11-08T13:01:00.000Z",
          unreadCount: 0,
          lastMessage: {
            key: {
              id: "L1",
              fromMe: false,
              remoteJid: "100000000000001@lid",
              remoteJidAlt: "59176543210@s.whatsapp.net",
              addressingMode: "lid",
            },
            pushName: "Mamá",
            message: { conversation: "Hola, buenas" },
            messageTimestamp: 1794146460,
          },
        },
        {
          remoteJid: "111111111111111@lid",
          pushName: null,
          lastMessage: {
            key: { id: "L2", fromMe: true, remoteJid: "111111111111111@lid" },
            pushName: "Você",
            message: { conversation: "Hola" },
            messageTimestamp: 1,
          },
        },
      ],
    });

    const [known, unknown] = await client.findChats();

    expect(known).toMatchObject({ jid: "100000000000001@lid", lid: "100000000000001@lid", phone: "59176543210", name: "Mamá" });
    expect(unknown).toMatchObject({ lid: "111111111111111@lid", phone: null, name: "111111111111111" });
  });

  it("finds the messages of a chat, oldest first", async () => {
    http.responses.push({
      status: 200,
      json: {
        messages: {
          total: 2,
          pages: 1,
          currentPage: 1,
          records: [
            {
              key: { id: "B", fromMe: true, remoteJid: "591@s.whatsapp.net" },
              message: { imageMessage: { mimetype: "image/jpeg", caption: "Así queda" } },
              messageTimestamp: 200,
            },
            {
              key: { id: "A", fromMe: false, remoteJid: "591@s.whatsapp.net" },
              pushName: "Ana",
              message: { extendedTextMessage: { text: "Hola" } },
              messageTimestamp: 100,
            },
          ],
        },
      },
    });

    const page = await client.findMessages("591@s.whatsapp.net");

    expect(http.requests[0]?.body).toEqual({ where: { key: { remoteJid: "591@s.whatsapp.net" } }, page: 1, offset: 50 });
    expect(page.pages).toBe(1);
    expect(page.messages.map((m) => [m.id, m.kind, m.text ?? m.caption])).toEqual([
      ["A", "text", "Hola"],
      ["B", "image", "Así queda"],
    ]);
  });

  it("sends text messages", async () => {
    await client.sendText("59171234567@s.whatsapp.net", "Hola!");
    expect(http.requests[0]).toMatchObject({
      method: "POST",
      url: "https://evo.example.com/message/sendText/shop",
      body: { number: "59171234567@s.whatsapp.net", text: "Hola!" },
    });
  });

  it("sends images as base64 media", async () => {
    await client.sendImage("59171234567@s.whatsapp.net", {
      base64: "AAAA",
      mimetype: "image/png",
      fileName: "QR Banco.png",
      caption: "Te paso el QR",
    });
    expect(http.requests[0]).toMatchObject({
      url: "https://evo.example.com/message/sendMedia/shop",
      body: {
        number: "59171234567@s.whatsapp.net",
        mediatype: "image",
        mimetype: "image/png",
        fileName: "QR Banco.png",
        caption: "Te paso el QR",
        media: "AAAA",
      },
    });
  });

  it("downloads the media of a message as base64", async () => {
    http.responses.push({ status: 200, json: { base64: "BBBB", mimetype: "image/jpeg" } });
    expect(await client.mediaBase64("MSG1")).toEqual({ base64: "BBBB", mimetype: "image/jpeg" });
    expect(http.requests[0]?.body).toEqual({ message: { key: { id: "MSG1" } }, convertToMp4: false });
  });

  it("turns error responses into EvolutionError with the server message", async () => {
    http.responses.push({ status: 401, json: { status: 401, error: "Unauthorized", response: { message: "Unauthorized" } } });
    const error = await client.connectionState().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EvolutionError);
    expect((error as EvolutionError).message).toBe("Evolution API respondió 401: Unauthorized");
    expect((error as EvolutionError).status).toBe(401);
  });

  it("refuses to call the server when the connection is not configured", async () => {
    const unconfigured = new EvolutionClient(http, () => ({ baseUrl: "", instance: "", apiKey: "" }));
    await expect(unconfigured.findChats()).rejects.toThrow("Configurá la URL, la instancia y la API key de Evolution API");
    expect(http.requests).toEqual([]);
  });
});
