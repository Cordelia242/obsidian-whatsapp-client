import { describe, expect, it } from "vitest";
import { localPhone, normalizePhone, phoneFromJid } from "../../src/customers/phone";

describe("normalizePhone", () => {
  it("prepends the default country code to local numbers", () => {
    expect(normalizePhone("70000001", "591")).toBe("59170000001");
  });

  it("accepts numbers stored as YAML numbers", () => {
    expect(normalizePhone(70000001, "591")).toBe("59170000001");
  });

  it("strips formatting, plus sign and 00 prefix from international numbers", () => {
    expect(normalizePhone("+591 700-000 01", "591")).toBe("59170000001");
    expect(normalizePhone("0059170000001", "591")).toBe("59170000001");
  });

  it("keeps foreign international numbers as they are", () => {
    expect(normalizePhone("+54 9 11 2345 6789", "591")).toBe("5491123456789");
  });

  it("returns null for empty values", () => {
    expect(normalizePhone("", "591")).toBeNull();
    expect(normalizePhone(undefined, "591")).toBeNull();
    expect(normalizePhone(null, "591")).toBeNull();
  });
});

describe("phoneFromJid", () => {
  it("extracts the number from a personal JID", () => {
    expect(phoneFromJid("59170000001@s.whatsapp.net")).toBe("59170000001");
  });

  it("ignores the device suffix", () => {
    expect(phoneFromJid("59170000001:12@s.whatsapp.net")).toBe("59170000001");
  });

  it("returns null for groups and LID addresses", () => {
    expect(phoneFromJid("120363000000000000@g.us")).toBeNull();
    expect(phoneFromJid("123456789012345@lid")).toBeNull();
  });
});

describe("localPhone", () => {
  it("removes the default country code", () => {
    expect(localPhone("59170000001", "591")).toBe("70000001");
  });

  it("keeps foreign numbers international", () => {
    expect(localPhone("5491123456789", "591")).toBe("+5491123456789");
  });
});
