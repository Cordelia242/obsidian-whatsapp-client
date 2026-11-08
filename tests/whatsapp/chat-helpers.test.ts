import { describe, expect, it } from "vitest";
import { qrCaption } from "../../src/payments/qr";
import { filterChats, imageMimetype } from "../../src/whatsapp/chat-helpers";
import type { Chat } from "../../src/whatsapp/messages";

const chat = (jid: string, name: string): Chat => ({
  jid,
  name,
  phone: jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0]! : null,
  updatedAt: 0,
  unreadCount: 0,
});

describe("qrCaption", () => {
  it("replaces every {nombre} with the customer name", () => {
    expect(qrCaption("Hola {nombre}! Gracias {nombre}", "Ana Rojas")).toBe("Hola Ana Rojas! Gracias Ana Rojas");
  });

  it("returns an empty caption for an empty template", () => {
    expect(qrCaption("  ", "Ana")).toBe("");
  });
});

describe("filterChats", () => {
  const chats = [
    chat("59171234567@s.whatsapp.net", "María Fernanda"),
    chat("59170000001@s.whatsapp.net", "Ana Rojas"),
    chat("120363@g.us", "Grupo ventas"),
  ];
  const isCustomer = (c: Chat) => c.jid.startsWith("59170000001");

  it("finds by name ignoring accents and case", () => {
    expect(filterChats(chats, "maria", "all", isCustomer).map((c) => c.name)).toEqual(["María Fernanda"]);
  });

  it("finds by phone digits", () => {
    expect(filterChats(chats, "0000", "all", isCustomer).map((c) => c.name)).toEqual(["Ana Rojas"]);
  });

  it("filters customers and unregistered personal chats, LID chats included", () => {
    const withLid = [...chats, { ...chat("100000000000001@lid", "Mamá"), lid: "100000000000001@lid" }];
    expect(filterChats(withLid, "", "customers", isCustomer).map((c) => c.name)).toEqual(["Ana Rojas"]);
    expect(filterChats(withLid, "", "unknown", isCustomer).map((c) => c.name)).toEqual(["María Fernanda", "Mamá"]);
  });
});

describe("imageMimetype", () => {
  it("maps image extensions and rejects the rest", () => {
    expect(imageMimetype("JPG")).toBe("image/jpeg");
    expect(imageMimetype("png")).toBe("image/png");
    expect(imageMimetype("pdf")).toBeNull();
  });
});
