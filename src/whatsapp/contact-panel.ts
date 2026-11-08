import { type App, FuzzySuggestModal, Notice, setIcon } from "obsidian";
import { CreateCustomerModal } from "../customers/create-customer-modal";
import type { ChatIdentity } from "../customers/customer-service";
import { normalizePhone } from "../customers/phone";
import type WhatsAppClientPlugin from "../main";
import { CreateOrderModal } from "../orders/create-order-modal";
import { unlink } from "../shared/notes";
import type { NoteRecord } from "../shared/vault-port";
import { ConfirmModal } from "../ui/confirm-modal";
import type { Chat } from "./messages";

export interface ContactPanelContext {
  app: App;
  plugin: WhatsAppClientPlugin;
  chat: Chat;
  /** Phone (resolved from the JID or `remoteJidAlt`) and LID of the chat. */
  identity: ChatIdentity;
  /** Re-renders the view after a vault change. */
  onChanged: () => void;
  sendQr: (customer: NoteRecord) => Promise<void>;
}

/** Right-hand panel: who this chat is in the vault, and the actions on it. */
export function renderContactPanel(container: HTMLElement, ctx: ContactPanelContext): void {
  container.empty();
  const { phone, lid } = ctx.identity;

  if (!phone && !lid) {
    container.createDiv({ cls: "cw-section-title", text: "CONTACTO" });
    container.createDiv({
      cls: "cw-callout",
      text: "Este chat es un grupo o una difusión, así que no se puede asociar a un cliente.",
    });
    return;
  }

  const customers = ctx.plugin.customers.findByChat(ctx.identity);
  if (customers.length === 0) renderUnknown(container, ctx);
  else renderCustomers(container, ctx, customers);
}

function renderUnknown(container: HTMLElement, ctx: ContactPanelContext): void {
  const { phone, lid } = ctx.identity;
  container.createDiv({ cls: "cw-section-title", text: "CONTACTO" });
  const callout = container.createDiv({ cls: "cw-callout cw-callout-warning" });
  callout.createDiv({ cls: "cw-callout-title", text: "No es cliente todavía" });
  callout.createDiv({
    text: phone
      ? "No hay ninguna nota en Clientes con este teléfono."
      : "WhatsApp no comparte el número de este chat. Al crear o vincular el cliente, el chat queda asociado igual.",
  });

  const facts = container.createDiv({ cls: "cw-facts" });
  fact(facts, "Nombre (WhatsApp)", ctx.chat.name);
  fact(facts, "Teléfono", phone ? `+${phone}` : "No disponible");

  button(container, "Crear cliente", "user-plus", true, () => {
    const prefill = { name: ctx.chat.name, phone: phone ?? undefined, lid: phone ? undefined : (lid ?? undefined) };
    new CreateCustomerModal(ctx.app, ctx.plugin.customers, prefill, ctx.onChanged).open();
  });
  button(container, "Vincular a cliente existente", "link", false, () => {
    new CustomerPicker(ctx.app, ctx.plugin.customers.all(), (customer) => void linkChat(ctx, customer)).open();
  });
  container.createDiv({
    cls: "cw-hint",
    text: "Por ejemplo, si esta persona ya es clienta pero escribe desde otro número.",
  });
}

function renderCustomers(container: HTMLElement, ctx: ContactPanelContext, customers: NoteRecord[]): void {
  container.createDiv({ cls: "cw-section-title", text: customers.length > 1 ? "CLIENTES CON ESTE TELÉFONO" : "CLIENTE" });

  for (const customer of customers) {
    const card = container.createDiv({ cls: "cw-customer" });
    const name = card.createEl("a", { cls: "cw-customer-name", text: customer.basename, href: "#" });
    name.addEventListener("click", (event) => {
      event.preventDefault();
      void ctx.app.workspace.openLinkText(customer.path, "", false);
    });
    const details = [unlink(customer.frontmatter.Ciudad), customer.frontmatter.fecha ? `cliente desde ${customer.frontmatter.fecha}` : ""];
    card.createDiv({ cls: "cw-hint", text: details.filter(Boolean).join(" · ") });

    const actions = card.createDiv({ cls: "cw-actions" });
    button(actions, "Nuevo pedido", "file-plus", true, () => {
      new CreateOrderModal(ctx.app, ctx.plugin.orderModalServices, customer.basename, ctx.onChanged).open();
    });
    button(actions, "Enviar QR", "qr-code", false, () => void ctx.sendQr(customer));

    const orders = ctx.plugin.orders.byCustomer(customer.basename);
    card.createDiv({ cls: "cw-section-title", text: "PEDIDOS" });
    if (orders.length === 0) card.createDiv({ cls: "cw-hint", text: "Sin pedidos todavía." });
    for (const order of orders.slice(0, 8)) {
      const row = card.createEl("a", { cls: "cw-order", href: "#" });
      row.createSpan({ text: order.basename });
      row.createSpan({ cls: "cw-order-status", text: unlink(order.frontmatter.estado) });
      row.addEventListener("click", (event) => {
        event.preventDefault();
        void ctx.app.workspace.openLinkText(order.path, "", false);
      });
    }
  }
}

async function linkChat(ctx: ContactPanelContext, customer: NoteRecord): Promise<void> {
  const { phone } = ctx.identity;
  const current = normalizePhone(customer.frontmatter.Telefono, ctx.plugin.settings.countryCode);
  const apply = async () => {
    try {
      await ctx.plugin.customers.linkChat(customer.path, ctx.identity);
      new Notice(`Chat vinculado a ${customer.basename}`);
      ctx.onChanged();
    } catch (error) {
      new Notice((error as Error).message);
    }
  };
  if (phone && current && current !== phone) {
    new ConfirmModal(
      ctx.app,
      "Reemplazar teléfono",
      `${customer.basename} tiene el teléfono ${String(customer.frontmatter.Telefono)}. ¿Reemplazarlo por +${phone}?`,
      "Reemplazar",
      () => void apply(),
    ).open();
  } else {
    await apply();
  }
}

function fact(container: HTMLElement, label: string, value: string): void {
  const row = container.createDiv({ cls: "cw-fact" });
  row.createSpan({ cls: "cw-muted", text: label });
  row.createSpan({ text: value });
}

function button(container: HTMLElement, label: string, icon: string, primary: boolean, onClick: () => void): HTMLButtonElement {
  const el = container.createEl("button", { cls: primary ? "cw-button mod-cta" : "cw-button" });
  setIcon(el.createSpan({ cls: "cw-button-icon" }), icon);
  el.createSpan({ text: label });
  el.addEventListener("click", onClick);
  return el;
}

class CustomerPicker extends FuzzySuggestModal<NoteRecord> {
  constructor(
    app: App,
    private readonly customers: NoteRecord[],
    private readonly onChoose: (customer: NoteRecord) => void,
  ) {
    super(app);
    this.setPlaceholder("Elegí el cliente al que pertenece este número");
  }

  getItems(): NoteRecord[] {
    return this.customers;
  }

  getItemText(customer: NoteRecord): string {
    const aliases = ([] as unknown[]).concat(customer.frontmatter.aliases ?? []).map(String);
    return aliases.length ? `${customer.basename} (${aliases.join(", ")})` : customer.basename;
  }

  onChooseItem(customer: NoteRecord): void {
    this.onChoose(customer);
  }
}
