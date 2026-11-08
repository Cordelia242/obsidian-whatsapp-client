import { beforeEach, describe, expect, it } from "vitest";
import { CustomerService } from "../../src/customers/customer-service";
import { InMemoryVault } from "../fakes/in-memory-vault";

describe("CustomerService", () => {
  let vault: InMemoryVault;
  let service: CustomerService;

  beforeEach(() => {
    vault = new InMemoryVault();
    vault.seed("Clientes/Ana Rojas.md", { Categoria: "[[Cliente]]", Ciudad: "[[Santa Cruz]]", Telefono: 70000001 });
    vault.seed("Clientes/Luis Pérez.md", { Categoria: "[[Cliente]]", Ciudad: "[[Santa Cruz]]", Telefono: 70000001 });
    vault.seed("Clientes/Prueba.md", { Categoria: "[[Cliente]]", Ciudad: "[[Cochabamba]]", Telefono: "70000002" });
    vault.seed("Prendas/C50.md", { Categoria: "[[Prenda]]", Telefono: 70000001 });
    service = new CustomerService(vault, { countryCode: () => "591", today: () => "2026-11-08" });
  });

  describe("findByPhone", () => {
    it("returns every customer whose phone matches, whatever the stored format", () => {
      const found = service.findByPhone("59170000001").map((n) => n.basename).sort();
      expect(found).toEqual(["Ana Rojas", "Luis Pérez"]);
    });

    it("returns an empty list when nobody has that phone", () => {
      expect(service.findByPhone("59170000000")).toEqual([]);
    });
  });

  it("lists the cities already used, without duplicates and sorted", () => {
    expect(service.cities()).toEqual(["Cochabamba", "Santa Cruz"]);
  });

  describe("findByChat", () => {
    it("matches by phone or by the stored WhatsApp LID", () => {
      vault.seed("Clientes/Mamá.md", { Categoria: "[[Cliente]]", Telefono: "", "WhatsApp LID": "100000000000001@lid" });
      expect(service.findByChat({ phone: null, lid: "100000000000001@lid" }).map((n) => n.basename)).toEqual(["Mamá"]);
      expect(service.findByChat({ phone: "59170000002", lid: "999@lid" }).map((n) => n.basename)).toEqual(["Prueba"]);
      expect(service.findByChat({ phone: null, lid: null })).toEqual([]);
    });
  });

  describe("linkChat", () => {
    it("stores the chat phone on an existing customer and returns the previous one", async () => {
      const previous = await service.linkChat("Clientes/Prueba.md", { phone: "59171234567", lid: null });
      expect(previous).toBe("70000002");
      expect(vault.notes.get("Clientes/Prueba.md")?.frontmatter.Telefono).toBe("71234567");
      expect(vault.notes.get("Clientes/Prueba.md")?.frontmatter).not.toHaveProperty("WhatsApp LID");
      expect(service.findByPhone("59171234567").map((n) => n.basename)).toEqual(["Prueba"]);
    });

    it("stores the LID and keeps the phone when the chat has no visible number", async () => {
      await service.linkChat("Clientes/Prueba.md", { phone: null, lid: "100000000000001@lid" });
      expect(vault.notes.get("Clientes/Prueba.md")?.frontmatter).toMatchObject({
        Telefono: "70000002",
        "WhatsApp LID": "100000000000001@lid",
      });
    });

    it("rejects notes that are not customers", async () => {
      await expect(service.linkChat("Prendas/C50.md", { phone: "59171234567", lid: null })).rejects.toThrow(
        "No es un cliente: Prendas/C50.md",
      );
    });
  });

  describe("create", () => {
    it("writes the note the Cliente template used to write", async () => {
      await service.create({ name: "María Fernanda", phone: "59171234567", city: "Santa Cruz" });

      const note = vault.notes.get("Clientes/María Fernanda.md");
      expect(note?.frontmatter).toEqual({
        Categoria: "[[Cliente]]",
        Ciudad: "[[Santa Cruz]]",
        Telefono: "71234567",
        fecha: "2026-11-08",
      });
      expect(note?.body).toBe("![[Pedidos Base.base#Pedidos por Cliente]]");
    });

    it("stores the WhatsApp LID when the chat hides the number", async () => {
      await service.create({ name: "Mamá", lid: "100000000000001@lid" });
      expect(vault.notes.get("Clientes/Mamá.md")?.frontmatter).toEqual({
        Categoria: "[[Cliente]]",
        Ciudad: "",
        Telefono: "",
        "WhatsApp LID": "100000000000001@lid",
        fecha: "2026-11-08",
      });
    });

    it("leaves city and phone empty when they are not given", async () => {
      await service.create({ name: "Sin datos" });
      expect(vault.notes.get("Clientes/Sin datos.md")?.frontmatter).toMatchObject({ Ciudad: "", Telefono: "" });
    });

    it("rejects an empty name", async () => {
      await expect(service.create({ name: "   " })).rejects.toThrow("El nombre no puede estar vacío");
    });

    it("rejects a name that already exists", async () => {
      await expect(service.create({ name: "Ana Rojas" })).rejects.toThrow('Ya existe un cliente llamado "Ana Rojas"');
    });

    it("removes characters that are not allowed in file names", async () => {
      const note = await service.create({ name: 'Ana / "La Rubia"' });
      expect(note.path).toBe("Clientes/Ana La Rubia.md");
    });
  });
});
