import { GARMENT_CATEGORY } from "../catalog/garment-service";
import { scalarText } from "../shared/json";
import { link, sanitizeBasename, sortedUnique, unlink } from "../shared/notes";
import type { NoteRecord, VaultPort } from "../shared/vault-port";

export const ORDER_CATEGORY = "Pedido";
export const ORDER_FOLDER = "Pedidos";

/** Column order of the "Pedidos Kanban" base. */
export const KANBAN_STATUSES = ["Reservado", "Pagado", "Empaquetado", "Enviado", "Entregado", "Cancelado"];

export interface NewOrder {
  /** Customer note name. */
  customer: string;
  /** Garment note name (one garment per order). */
  garment: string;
  status: string;
  date?: string;
}

export function isCancelled(status: unknown): boolean {
  return /^cancelad[oa]s?$/i.test(unlink(status));
}

export class OrderService {
  constructor(
    private readonly vault: VaultPort,
    private readonly options: { today: () => string },
  ) {}

  all(): NoteRecord[] {
    return this.vault.notesByCategory(ORDER_CATEGORY);
  }

  statuses(): string[] {
    const used = sortedUnique(this.all().map((n) => unlink(n.frontmatter.estado)));
    return [...KANBAN_STATUSES, ...used.filter((s) => !KANBAN_STATUSES.includes(s))];
  }

  byCustomer(customer: string): NoteRecord[] {
    return this.all()
      .filter((n) => unlink(n.frontmatter.cliente) === customer)
      .sort((a, b) => scalarText(b.frontmatter.fecha).localeCompare(scalarText(a.frontmatter.fecha)));
  }

  /**
   * Same rule as the Pedido template: only garments with at least one order that is not cancelled.
   * Pending user confirmation (feature doc L9): the rule may be inverted.
   */
  garmentsForNewOrder(): NoteRecord[] {
    const active = new Set(
      this.all()
        .filter((n) => n.frontmatter.prenda && !isCancelled(n.frontmatter.estado))
        .map((n) => unlink(n.frontmatter.prenda)),
    );
    return this.vault
      .notesByCategory(GARMENT_CATEGORY)
      .filter((g) => active.has(g.basename))
      .sort((a, b) => a.basename.localeCompare(b.basename));
  }

  async create(input: NewOrder): Promise<NoteRecord> {
    const customer = input.customer.trim();
    const garment = input.garment.trim();
    const status = input.status.trim();
    if (!customer) throw new Error("Elegí un cliente");
    if (!garment) throw new Error("Elegí una prenda");
    if (!status) throw new Error("El estado no puede estar vacío");

    return this.vault.createNote({
      folder: ORDER_FOLDER,
      basename: this.freeName(sanitizeBasename(`Pedido - ${garment}`)),
      frontmatter: {
        Categoria: link(ORDER_CATEGORY),
        fecha: input.date ?? this.options.today(),
        prenda: link(garment),
        estado: link(status),
        cliente: link(customer),
      },
      body: "",
    });
  }

  private freeName(base: string): string {
    let name = base;
    for (let n = 2; this.vault.exists(`${ORDER_FOLDER}/${name}.md`); n++) name = `${base} (${n})`;
    return name;
  }
}
