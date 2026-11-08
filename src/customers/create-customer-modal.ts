import { type App, Notice } from "obsidian";
import type { NoteRecord } from "../shared/vault-port";
import { FormModal } from "../ui/form-modal";
import type { CustomerService } from "./customer-service";

export interface CustomerPrefill {
  name?: string;
  /** International digits from a WhatsApp chat; when given, the field is read-only. */
  phone?: string;
  /** LID of a chat whose number WhatsApp hides; saved on the note. */
  lid?: string;
}

export class CreateCustomerModal extends FormModal {
  private nameInput!: HTMLInputElement;
  private phoneInput!: HTMLInputElement;
  private cityInput!: HTMLInputElement;

  constructor(
    app: App,
    private readonly customers: CustomerService,
    private readonly prefill: CustomerPrefill,
    private readonly onCreated: (note: NoteRecord) => void,
  ) {
    super(app, "Crear cliente", "Crear cliente");
  }

  protected buildFields(container: HTMLElement): void {
    const fromChat = Boolean(this.prefill.phone || this.prefill.lid);
    const phoneFromChat = Boolean(this.prefill.phone);
    if (fromChat) container.createEl("p", { text: "Datos precargados desde el chat de WhatsApp.", cls: "setting-item-description" });

    this.nameInput = this.field(container, "Nombre", {
      value: this.prefill.name,
      description: fromChat ? "Viene del nombre de perfil. Es el nombre de la nota." : undefined,
    });
    this.phoneInput = this.field(container, "Teléfono", {
      value: this.prefill.phone ? `+${this.prefill.phone}` : "",
      readonly: phoneFromChat,
      description: phoneFromChat
        ? "Tomado del chat."
        : this.prefill.lid
          ? "WhatsApp no comparte el número de este chat. Escribilo si lo sabés; el chat queda vinculado igual."
          : undefined,
    });
    this.cityInput = this.field(container, "Ciudad", {
      suggestions: this.customers.cities(),
      placeholder: "Elegí una o escribí una nueva",
    });
    window.setTimeout(() => (fromChat ? this.cityInput : this.nameInput).focus(), 0);
  }

  protected async submit(): Promise<void> {
    const note = await this.customers.create({
      name: this.nameInput.value,
      phone: this.phoneInput.value,
      city: this.cityInput.value,
      lid: this.prefill.lid,
    });
    new Notice(`Cliente creado: ${note.basename}`);
    this.onCreated(note);
  }
}
