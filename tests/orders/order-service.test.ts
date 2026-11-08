import { beforeEach, describe, expect, it } from "vitest";
import { OrderService } from "../../src/orders/order-service";
import { InMemoryVault } from "../fakes/in-memory-vault";

describe("OrderService", () => {
  let vault: InMemoryVault;
  let orders: OrderService;

  beforeEach(() => {
    vault = new InMemoryVault();
    for (const name of ["C50", "S50", "T50", "O50"]) vault.seed(`Prendas/${name}.md`, { Categoria: "[[Prenda]]" });
    vault.seed("Pedidos/Pedido - C50.md", {
      Categoria: "[[Pedido]]",
      fecha: "2026-11-01",
      prenda: "[[C50]]",
      estado: "[[Pagado]]",
      cliente: "[[Ana Rojas]]",
    });
    vault.seed("Pedidos/Pedido - T50.md", {
      Categoria: "[[Pedido]]",
      fecha: "2026-11-05",
      prenda: "[[T50]]",
      estado: "Cancelado",
      cliente: "[[Ana Rojas]]",
    });
    vault.seed("Pedidos/Pedido - S50.md", {
      Categoria: "[[Pedido]]",
      fecha: "2026-11-07",
      prenda: "[[S50]]",
      estado: "[[En camino]]",
      cliente: "[[Luis Pérez]]",
    });
    orders = new OrderService(vault, { today: () => "2026-11-08" });
  });

  it("offers the Kanban statuses first and then any other status already used", () => {
    expect(orders.statuses()).toEqual(["Reservado", "Pagado", "Empaquetado", "Enviado", "Entregado", "Cancelado", "En camino"]);
  });

  it("lists a customer's orders, newest first", () => {
    expect(orders.byCustomer("Ana Rojas").map((n) => n.basename)).toEqual(["Pedido - T50", "Pedido - C50"]);
  });

  it("keeps the template rule: only garments with at least one non-cancelled order", () => {
    expect(orders.garmentsForNewOrder().map((n) => n.basename)).toEqual(["C50", "S50"]);
  });

  it("writes the note the Pedido template used to write", async () => {
    const note = await orders.create({ customer: "María Fernanda", garment: "O50", status: "Reservado" });
    expect(note.path).toBe("Pedidos/Pedido - O50.md");
    expect(vault.notes.get(note.path)?.frontmatter).toEqual({
      Categoria: "[[Pedido]]",
      fecha: "2026-11-08",
      prenda: "[[O50]]",
      estado: "[[Reservado]]",
      cliente: "[[María Fernanda]]",
    });
  });

  it("adds a numeric suffix when the order name is taken", async () => {
    const second = await orders.create({ customer: "Ana Rojas", garment: "C50", status: "Pagado" });
    const third = await orders.create({ customer: "Ana Rojas", garment: "C50", status: "Pagado" });
    expect([second.basename, third.basename]).toEqual(["Pedido - C50 (2)", "Pedido - C50 (3)"]);
  });

  it("requires customer, garment and status", async () => {
    await expect(orders.create({ customer: "", garment: "C50", status: "Pagado" })).rejects.toThrow("Elegí un cliente");
    await expect(orders.create({ customer: "Ana Rojas", garment: "", status: "Pagado" })).rejects.toThrow("Elegí una prenda");
    await expect(orders.create({ customer: "Ana Rojas", garment: "C50", status: " " })).rejects.toThrow(
      "El estado no puede estar vacío",
    );
  });
});
