import { beforeEach, describe, expect, it } from "vitest";
import { BaleService } from "../../src/catalog/bale-service";
import { GarmentService } from "../../src/catalog/garment-service";
import { InMemoryVault } from "../fakes/in-memory-vault";

const today = () => "2026-11-08";

describe("BaleService", () => {
  let vault: InMemoryVault;
  let bales: BaleService;

  beforeEach(() => {
    vault = new InMemoryVault();
    vault.seed("Fardo/Fardo Inicial.md", { Categoria: "[[Fardo]]", fecha: "2026-09-10" });
    vault.seed("Fardo/Fardo Octubre.md", { Categoria: "[[Fardo]]", fecha: "2026-10-01" });
    bales = new BaleService(vault, { today });
  });

  it("lists bales newest first", () => {
    expect(bales.all().map((n) => n.basename)).toEqual(["Fardo Octubre", "Fardo Inicial"]);
  });

  it("writes the note the Fardo template used to write", async () => {
    await bales.create({ name: "Fardo Noviembre", price: "3000", quantity: "256" });
    expect(vault.notes.get("Fardo/Fardo Noviembre.md")?.frontmatter).toEqual({
      Categoria: "[[Fardo]]",
      fecha: "2026-11-08",
      Precio: 3000,
      "Cantidad de Prendas": 256,
    });
  });

  it("rejects an empty or repeated name", async () => {
    await expect(bales.create({ name: "", price: "1", quantity: "1" })).rejects.toThrow("El nombre no puede estar vacío");
    await expect(bales.create({ name: "Fardo Inicial", price: "1", quantity: "1" })).rejects.toThrow(
      'Ya existe un fardo llamado "Fardo Inicial"',
    );
  });
});

describe("GarmentService", () => {
  let vault: InMemoryVault;
  let garments: GarmentService;

  beforeEach(() => {
    vault = new InMemoryVault();
    vault.seed("Prendas/C50.md", { Categoria: "[[Prenda]]", Tipo: "[[Coreana]]" });
    vault.seed("Prendas/T50.md", { Categoria: "[[Prenda]]", Tipo: "[[Americana]]" });
    vault.seed("Prendas/S50.md", { Categoria: "[[Prenda]]", Tipo: "[[Coreana]]" });
    garments = new GarmentService(vault, { today });
  });

  it("lists the types already used", () => {
    expect(garments.types()).toEqual(["Americana", "Coreana"]);
  });

  it("writes the note the Prenda template used to write", async () => {
    await garments.create({ name: "B12", type: "Coreana", details: "Talla M", price: "25", bale: "Fardo Inicial" });
    expect(vault.notes.get("Prendas/B12.md")?.frontmatter).toEqual({
      Categoria: "[[Prenda]]",
      Tipo: "[[Coreana]]",
      Detalles: "Talla M",
      Precio: 25,
      Fardo: "[[Fardo Inicial]]",
      fecha: "2026-11-08",
    });
  });

  it("requires a bale", async () => {
    await expect(garments.create({ name: "B13", price: "25", bale: "" })).rejects.toThrow("Elegí un fardo");
  });
});
