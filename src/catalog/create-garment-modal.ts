import { type App, Notice, Setting } from "obsidian";
import type { NoteRecord } from "../shared/vault-port";
import { FormModal } from "../ui/form-modal";
import type { BaleService } from "./bale-service";
import { CreateBaleModal } from "./create-bale-modal";
import type { GarmentService } from "./garment-service";

export class CreateGarmentModal extends FormModal {
  private nameInput!: HTMLInputElement;
  private typeInput!: HTMLInputElement;
  private baleSelect!: HTMLSelectElement;
  private detailsInput!: HTMLInputElement;
  private priceInput!: HTMLInputElement;

  constructor(
    app: App,
    private readonly garments: GarmentService,
    private readonly bales: BaleService,
    private readonly onCreated: (note: NoteRecord) => void,
    private readonly initialName = "",
  ) {
    super(app, "Nueva prenda", "Crear prenda");
  }

  protected buildFields(container: HTMLElement): void {
    this.nameInput = this.field(container, "Nombre", { value: this.initialName });
    this.typeInput = this.field(container, "Tipo", {
      suggestions: this.garments.types(),
      placeholder: "Elegí uno o escribí uno nuevo",
    });

    const baleNames = this.bales.all().map((b) => b.basename);
    this.baleSelect = this.select(container, "Fardo", baleNames);
    new Setting(container).setDesc(baleNames.length ? "" : "Todavía no hay fardos.").addButton((b) =>
      b.setButtonText("Nuevo fardo…").onClick(() => {
        new CreateBaleModal(this.app, this.bales, (bale) => {
          this.baleSelect.add(new Option(bale.basename, bale.basename), 0);
          this.baleSelect.value = bale.basename;
        }).open();
      }),
    );

    this.detailsInput = this.field(container, "Detalles");
    this.priceInput = this.field(container, "Precio", { type: "number" });
    window.setTimeout(() => this.nameInput.focus(), 0);
  }

  protected async submit(): Promise<void> {
    const note = await this.garments.create({
      name: this.nameInput.value,
      type: this.typeInput.value,
      bale: this.baleSelect.value,
      details: this.detailsInput.value,
      price: this.priceInput.value,
    });
    new Notice(`Prenda creada: ${note.basename}`);
    this.onCreated(note);
  }
}
