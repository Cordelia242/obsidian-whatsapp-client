import { type App, Notice } from "obsidian";
import type { NoteRecord } from "../shared/vault-port";
import { FormModal } from "../ui/form-modal";
import type { BaleService } from "./bale-service";

export class CreateBaleModal extends FormModal {
  private nameInput!: HTMLInputElement;
  private priceInput!: HTMLInputElement;
  private quantityInput!: HTMLInputElement;

  constructor(
    app: App,
    private readonly bales: BaleService,
    private readonly onCreated: (note: NoteRecord) => void,
    private readonly initialName = "",
  ) {
    super(app, "Nuevo fardo", "Crear fardo");
  }

  protected buildFields(container: HTMLElement): void {
    this.nameInput = this.field(container, "Nombre", { value: this.initialName });
    this.priceInput = this.field(container, "Precio", { type: "number" });
    this.quantityInput = this.field(container, "Cantidad de prendas", { type: "number" });
    window.setTimeout(() => this.nameInput.focus(), 0);
  }

  protected async submit(): Promise<void> {
    const note = await this.bales.create({
      name: this.nameInput.value,
      price: this.priceInput.value,
      quantity: this.quantityInput.value,
    });
    new Notice(`Fardo creado: ${note.basename}`);
    this.onCreated(note);
  }
}
