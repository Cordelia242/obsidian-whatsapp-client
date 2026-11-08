import { type App, Notice, Setting } from "obsidian";
import type { BaleService } from "../catalog/bale-service";
import { CreateGarmentModal } from "../catalog/create-garment-modal";
import type { GarmentService } from "../catalog/garment-service";
import type { CustomerService } from "../customers/customer-service";
import { scalarText } from "../shared/json";
import { isoDate, unlink } from "../shared/notes";
import type { NoteRecord } from "../shared/vault-port";
import { FormModal } from "../ui/form-modal";
import type { OrderService } from "./order-service";

export interface OrderModalServices {
  orders: OrderService;
  customers: CustomerService;
  garments: GarmentService;
  bales: BaleService;
}

export class CreateOrderModal extends FormModal {
  private customerInput!: HTMLInputElement;
  private garmentInput!: HTMLInputElement;
  private statusInput!: HTMLInputElement;
  private dateInput!: HTMLInputElement;

  constructor(
    app: App,
    private readonly services: OrderModalServices,
    /** Customer fixed by the WhatsApp chat; when missing the user picks one. */
    private readonly customer: string | undefined,
    private readonly onCreated: (note: NoteRecord) => void,
  ) {
    super(app, "Nuevo pedido", "Crear pedido");
  }

  protected buildFields(container: HTMLElement): void {
    const { customers, orders, garments, bales } = this.services;
    this.customerInput = this.field(container, "Cliente", {
      value: this.customer,
      readonly: Boolean(this.customer),
      description: this.customer ? "Fijado desde el chat." : undefined,
      suggestions: this.customer ? undefined : customers.all().map(withAliases),
    });

    this.garmentInput = this.field(container, "Prenda", {
      suggestions: orders.garmentsForNewOrder().map(garmentLabel),
      placeholder: "Buscá por nombre",
    });
    new Setting(container).addButton((b) =>
      b.setButtonText("Nueva prenda…").onClick(() => {
        new CreateGarmentModal(this.app, garments, bales, (g) => (this.garmentInput.value = g.basename), this.garmentInput.value).open();
      }),
    );

    this.statusInput = this.field(container, "Estado", {
      suggestions: orders.statuses(),
      placeholder: "Reservado, Pagado…",
    });
    this.dateInput = this.field(container, "Fecha", { type: "date", value: isoDate() });
    window.setTimeout(() => (this.customer ? this.garmentInput : this.customerInput).focus(), 0);
  }

  protected async submit(): Promise<void> {
    const customer = noteName(this.customerInput.value);
    const garment = noteName(this.garmentInput.value);
    if (customer && !this.services.customers.all().some((c) => c.basename === customer)) {
      throw new Error(`No existe el cliente "${customer}". Crealo primero.`);
    }
    if (garment && !this.services.garments.all().some((g) => g.basename === garment)) {
      throw new Error(`No existe la prenda "${garment}". Usá "Nueva prenda…".`);
    }
    const note = await this.services.orders.create({
      customer,
      garment,
      status: this.statusInput.value,
      date: this.dateInput.value || undefined,
    });
    new Notice(`Pedido creado: ${note.basename}`);
    this.onCreated(note);
  }
}

/** Suggestion text "Name (alias, alias)", so aliases can be typed too. */
function withAliases(note: NoteRecord): string {
  const aliases = ([] as unknown[]).concat(note.frontmatter.aliases ?? []).map(String);
  return aliases.length ? `${note.basename} (${aliases.join(", ")})` : note.basename;
}

function garmentLabel(note: NoteRecord): string {
  const type = unlink(note.frontmatter.Tipo);
  const price = scalarText(note.frontmatter.Precio);
  const extra = [type, price ? `${price} Bs` : ""].filter(Boolean);
  return extra.length ? `${note.basename} (${extra.join(" · ")})` : note.basename;
}

/** Undoes `withAliases`/`garmentLabel`: "C50 (Coreana · 25 Bs)" → "C50". */
function noteName(text: string): string {
  return text.replace(/\s*\([^)]*\)\s*$/, "").trim();
}
