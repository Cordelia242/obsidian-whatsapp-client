import { ItemView, Menu, Modal, Notice, Platform, type TFile, type WorkspaceLeaf, arrayBufferToBase64, debounce, setIcon } from "obsidian";
import type WhatsAppClientPlugin from "../main";
import { qrCaption } from "../payments/qr";
import { FileSuggestModal, IMAGE_EXTENSIONS } from "../shared/file-suggest-modal";
import type { NoteRecord } from "../shared/vault-port";
import type { ChatIdentity } from "../customers/customer-service";
import { type ChatFilter, filterChats, imageMimetype, initials } from "./chat-helpers";
import type { OutgoingImage } from "./evolution-client";
import { ImageLoader } from "./image-loader";
import { type Chat, type ChatMessage, phoneOfChat, previewOf } from "./messages";
import { renderContactPanel } from "./contact-panel";
import { MIN_POLL_SECONDS } from "../settings/settings";

export const WHATSAPP_VIEW_TYPE = "whatsapp-client";

/** Device-local (not synced by LiveSync): last open chat. */
const SELECTED_CHAT_KEY = "whatsapp-client-selected-chat";

type Pane = "list" | "chat" | "contact";

const FILTERS: { id: ChatFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "customers", label: "Clientes" },
  { id: "unknown", label: "No registrados" },
];

export class WhatsAppView extends ItemView {
  private chats: Chat[] = [];
  private messages: ChatMessage[] = [];
  private messagesSignature = "";
  private selectedJid: string | null = null;
  private query = "";
  private filter: ChatFilter = "all";
  private pane: Pane = "list";
  private refreshing = false;
  private scrollToEnd = true;
  private readonly images: ImageLoader;

  private rootEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private listEl!: HTMLElement;
  private chatHeaderEl!: HTMLElement;
  private messagesEl!: HTMLElement;
  private composerInput!: HTMLTextAreaElement;
  private contactEl!: HTMLElement;
  private fileInput!: HTMLInputElement;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: WhatsAppClientPlugin,
  ) {
    super(leaf);
    this.images = new ImageLoader(plugin.evolution);
  }

  getViewType(): string {
    return WHATSAPP_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "WhatsApp";
  }

  getIcon(): string {
    return "message-circle";
  }

  async onOpen(): Promise<void> {
    this.selectedJid = (this.app.loadLocalStorage(SELECTED_CHAT_KEY) as string | null) ?? null;
    this.buildLayout();
    // Vault changes (a customer created here, an order created elsewhere, a LiveSync pull) refresh the panel.
    this.registerEvent(this.app.metadataCache.on("changed", debounce(() => this.renderContact(), 300, true)));
    const seconds = Math.max(MIN_POLL_SECONDS, this.plugin.settings.pollSeconds);
    this.registerInterval(window.setInterval(() => void this.refresh(), seconds * 1000));
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  // ----- layout -----

  private buildLayout(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("cw-view");
    this.rootEl = root.createDiv({ cls: "cw-root" });

    const list = this.rootEl.createDiv({ cls: "cw-pane cw-list" });
    const listHeader = list.createDiv({ cls: "cw-list-header" });
    this.statusEl = listHeader.createDiv({ cls: "cw-status", text: "Conectando…" });
    const search = listHeader.createEl("input", {
      cls: "cw-search",
      attr: { type: "search", placeholder: "Buscar por nombre o teléfono", "aria-label": "Buscar chat" },
    });
    search.addEventListener("input", () => {
      this.query = search.value;
      this.renderList();
    });
    const chips = listHeader.createDiv({ cls: "cw-chips" });
    for (const f of FILTERS) {
      const chip = chips.createEl("button", { cls: "cw-chip", text: f.label });
      chip.toggleClass("is-active", f.id === this.filter);
      chip.addEventListener("click", () => {
        this.filter = f.id;
        chips.querySelectorAll(".cw-chip").forEach((c) => c.removeClass("is-active"));
        chip.addClass("is-active");
        this.renderList();
      });
    }
    this.listEl = list.createDiv({ cls: "cw-chat-list" });

    const chat = this.rootEl.createDiv({ cls: "cw-pane cw-chat" });
    this.chatHeaderEl = chat.createDiv({ cls: "cw-chat-header" });
    this.messagesEl = chat.createDiv({ cls: "cw-messages" });
    const composer = chat.createDiv({ cls: "cw-composer" });
    const attach = composer.createEl("button", { cls: "cw-icon-button", attr: { "aria-label": "Adjuntar imagen" } });
    setIcon(attach, "paperclip");
    attach.addEventListener("click", (event) => this.openAttachMenu(event));
    this.composerInput = composer.createEl("textarea", {
      cls: "cw-input",
      attr: { rows: "1", placeholder: "Escribí un mensaje", "aria-label": "Mensaje" },
    });
    this.composerInput.addEventListener("keydown", (event) => {
      // Desktop: Enter sends, Shift+Enter breaks the line. Mobile keyboards keep Enter as new line.
      if (event.key === "Enter" && !event.shiftKey && !Platform.isMobile) {
        event.preventDefault();
        void this.sendText();
      }
    });
    const send = composer.createEl("button", { cls: "cw-send mod-cta", text: "Enviar" });
    send.addEventListener("click", () => void this.sendText());

    this.fileInput = chat.createEl("input", { attr: { type: "file", accept: "image/*", hidden: "true" } });
    this.fileInput.addEventListener("change", () => void this.sendPickedFile());

    this.contactEl = this.rootEl.createDiv({ cls: "cw-pane cw-contact" });

    this.setPane(this.selectedJid ? "chat" : "list");
    this.renderChatHeader();
  }

  /** On narrow screens (phones, split panes) only one pane is visible; CSS reads data-pane. */
  private setPane(pane: Pane): void {
    this.pane = pane;
    this.rootEl.dataset.pane = pane;
  }

  // ----- data -----

  private async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      this.chats = (await this.plugin.evolution.findChats()).sort((a, b) => b.updatedAt - a.updatedAt);
      this.setStatus("Conectado", "ok");
      this.renderList();
      this.renderChatHeader();
      if (this.selectedJid) await this.loadMessages(this.selectedJid);
    } catch (error) {
      this.setStatus((error as Error).message, "error");
    } finally {
      this.refreshing = false;
    }
  }

  private async loadMessages(jid: string): Promise<void> {
    const { messages } = await this.plugin.evolution.findMessages(jid);
    if (jid !== this.selectedJid) return;
    const signature = `${jid}|${messages.length}|${messages[messages.length - 1]?.id ?? ""}`;
    if (signature === this.messagesSignature) return;
    this.messagesSignature = signature;
    this.messages = messages;
    this.renderMessages();
    // LID chats: the phone may only appear in these messages' remoteJidAlt.
    if (!this.selectedChat?.phone) this.renderChatHeader();
  }

  private async selectChat(jid: string): Promise<void> {
    this.selectedJid = jid;
    this.app.saveLocalStorage(SELECTED_CHAT_KEY, jid);
    this.messages = [];
    this.messagesSignature = "";
    this.scrollToEnd = true;
    this.setPane("chat");
    this.renderList();
    this.renderChatHeader();
    this.renderMessages();
    this.renderContact();
    try {
      await this.loadMessages(jid);
    } catch (error) {
      new Notice((error as Error).message);
    }
  }

  private get selectedChat(): Chat | undefined {
    return this.chats.find((c) => c.jid === this.selectedJid);
  }

  /** Phone and LID of a chat; the open chat also looks at its loaded messages for `remoteJidAlt`. */
  private identityOf(chat: Chat): ChatIdentity {
    const messages = chat.jid === this.selectedJid ? this.messages : [];
    const phone = chat.phone ?? phoneOfChat(chat.jid, messages);
    return { phone, lid: chat.lid ?? null };
  }

  private isCustomer = (chat: Chat): boolean => {
    const identity = this.identityOf(chat);
    return (identity.phone !== null || identity.lid !== null) && this.plugin.customers.findByChat(identity).length > 0;
  };

  // ----- rendering -----

  private setStatus(text: string, kind: "ok" | "error"): void {
    this.statusEl.empty();
    this.statusEl.toggleClass("is-error", kind === "error");
    this.statusEl.createSpan({ cls: "cw-dot" });
    const instance = this.plugin.settings.instance;
    this.statusEl.createSpan({ text: kind === "ok" && instance ? `${text} · instancia ${instance}` : text });
  }

  private renderList(): void {
    this.listEl.empty();
    const visible = filterChats(this.chats, this.query, this.filter, this.isCustomer);
    if (visible.length === 0) {
      this.listEl.createDiv({ cls: "cw-empty", text: this.chats.length ? "Ningún chat coincide." : "Sin chats todavía." });
      return;
    }
    for (const chat of visible) {
      const item = this.listEl.createEl("button", { cls: "cw-chat-item" });
      item.toggleClass("is-active", chat.jid === this.selectedJid);
      this.avatar(item, chat);
      const body = item.createDiv({ cls: "cw-chat-item-body" });
      const top = body.createDiv({ cls: "cw-row" });
      top.createSpan({ cls: "cw-chat-name", text: chat.name });
      top.createSpan({ cls: "cw-time", text: shortTime(chat.lastMessage?.timestamp || chat.updatedAt) });
      const bottom = body.createDiv({ cls: "cw-row" });
      bottom.createSpan({ cls: "cw-preview", text: previewOf(chat.lastMessage) });
      if (chat.unreadCount > 0) bottom.createSpan({ cls: "cw-unread", text: String(chat.unreadCount) });
      if (chat.phone || chat.lid) {
        const customer = this.isCustomer(chat);
        body.createSpan({ cls: customer ? "cw-tag is-customer" : "cw-tag", text: customer ? "Cliente" : "No registrado" });
      }
      item.addEventListener("click", () => void this.selectChat(chat.jid));
    }
  }

  private renderChatHeader(): void {
    this.chatHeaderEl.empty();
    const back = this.chatHeaderEl.createEl("button", { cls: "cw-icon-button cw-back", attr: { "aria-label": "Volver a los chats" } });
    setIcon(back, "arrow-left");
    back.addEventListener("click", () => this.setPane("list"));

    const chat = this.selectedChat;
    if (!chat) {
      this.chatHeaderEl.createDiv({ cls: "cw-muted", text: this.selectedJid ? "Cargando chat…" : "Elegí un chat" });
      return;
    }
    this.avatar(this.chatHeaderEl, chat);
    const info = this.chatHeaderEl.createDiv({ cls: "cw-chat-title" });
    info.createDiv({ cls: "cw-chat-name", text: chat.name });
    const { phone } = this.identityOf(chat);
    info.createDiv({ cls: "cw-muted", text: phone ? `+${phone}` : "Número no compartido por WhatsApp" });

    const contact = this.chatHeaderEl.createEl("button", { cls: "cw-icon-button cw-contact-toggle", attr: { "aria-label": "Ver contacto" } });
    setIcon(contact, "user");
    contact.addEventListener("click", () => this.setPane("contact"));
    this.renderContact();
  }

  private renderMessages(): void {
    const atBottom = this.messagesEl.scrollHeight - this.messagesEl.scrollTop - this.messagesEl.clientHeight < 80;
    this.messagesEl.empty();
    if (!this.selectedJid) return;
    let lastDay = "";
    for (const message of this.messages) {
      const day = new Date(message.timestamp).toLocaleDateString();
      if (day !== lastDay) {
        this.messagesEl.createDiv({ cls: "cw-day", text: dayLabel(message.timestamp) });
        lastDay = day;
      }
      const bubble = this.messagesEl.createDiv({ cls: message.fromMe ? "cw-bubble is-mine" : "cw-bubble" });
      if (message.kind === "image") this.renderImage(bubble, message);
      const text = message.kind === "text" ? message.text : message.kind === "image" ? message.caption : `[${message.label}]`;
      if (text) bubble.createDiv({ cls: "cw-text", text });
      bubble.createDiv({ cls: "cw-time", text: new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    }
    // Follow new messages only when the user was already at the end (or just opened the chat).
    if (atBottom || this.scrollToEnd) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      this.scrollToEnd = this.messages.length === 0;
    }
  }

  private renderImage(bubble: HTMLElement, message: ChatMessage): void {
    this.fillImage(bubble.createDiv({ cls: "cw-image" }), message);
  }

  private fillImage(frame: HTMLElement, message: ChatMessage): void {
    const show = (url: string) => {
      frame.empty();
      const img = frame.createEl("img", { attr: { src: url, alt: message.caption ?? "Imagen del chat" } });
      img.addEventListener("click", () => new ImagePreviewModal(this.app, url).open());
    };
    const cached = this.images.cached(message.id);
    if (cached) return show(cached);
    frame.empty();
    frame.setText("Cargando imagen…");
    this.images.load(message.id).then(show, () => {
      frame.empty();
      const retry = frame.createEl("button", { cls: "cw-button", text: "No se pudo cargar · Reintentar" });
      retry.addEventListener("click", () => this.fillImage(frame, message));
    });
  }

  private renderContact(): void {
    const chat = this.selectedChat;
    this.contactEl.empty();
    const back = this.contactEl.createEl("button", { cls: "cw-icon-button cw-back", attr: { "aria-label": "Volver al chat" } });
    setIcon(back, "arrow-left");
    back.addEventListener("click", () => this.setPane("chat"));
    if (!chat) return;
    const body = this.contactEl.createDiv({ cls: "cw-contact-body" });
    renderContactPanel(body, {
      app: this.app,
      plugin: this.plugin,
      chat,
      identity: this.identityOf(chat),
      onChanged: () => {
        this.renderContact();
        this.renderList();
      },
      sendQr: (customer) => this.sendQr(customer),
    });
  }

  private avatar(container: HTMLElement, chat: Chat): void {
    const avatar = container.createDiv({ cls: "cw-avatar" });
    if (chat.profilePicUrl) {
      const img = avatar.createEl("img", { attr: { src: chat.profilePicUrl, alt: "" } });
      img.addEventListener("error", () => {
        img.remove();
        avatar.setText(initials(chat.name));
      });
    } else {
      avatar.setText(initials(chat.name));
    }
  }

  // ----- sending -----

  private async sendText(): Promise<void> {
    const text = this.composerInput.value.trim();
    if (!text || !this.selectedJid) return;
    try {
      await this.plugin.evolution.sendText(this.selectedJid, text);
      this.composerInput.value = "";
      await this.loadMessages(this.selectedJid);
    } catch (error) {
      new Notice((error as Error).message);
    }
  }

  private openAttachMenu(event: MouseEvent): void {
    if (!this.selectedJid) return;
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle(Platform.isMobile ? "Galería o cámara" : "Imagen del equipo")
        .setIcon("image")
        .onClick(() => this.fileInput.click()),
    );
    menu.addItem((item) =>
      item
        .setTitle("Imagen de la bóveda")
        .setIcon("vault")
        .onClick(() => new FileSuggestModal(this.app, IMAGE_EXTENSIONS, (file) => void this.sendVaultImage(file)).open()),
    );
    menu.showAtMouseEvent(event);
  }

  /** The text typed in the composer travels as the image caption. */
  private async sendImage(image: Omit<OutgoingImage, "caption">, caption = this.composerInput.value.trim()): Promise<void> {
    const jid = this.selectedJid;
    if (!jid) return;
    const notice = new Notice("Enviando imagen…", 0);
    try {
      await this.plugin.evolution.sendImage(jid, { ...image, caption });
      if (caption === this.composerInput.value.trim()) this.composerInput.value = "";
      await this.loadMessages(jid);
    } catch (error) {
      new Notice((error as Error).message);
    } finally {
      notice.hide();
    }
  }

  private async sendPickedFile(): Promise<void> {
    const file = this.fileInput.files?.[0];
    this.fileInput.value = "";
    if (!file) return;
    const mimetype = file.type || imageMimetype(file.name.split(".").pop() ?? "");
    if (!mimetype?.startsWith("image/")) return void new Notice("Solo se pueden adjuntar imágenes");
    await this.sendImage({ base64: arrayBufferToBase64(await file.arrayBuffer()), mimetype, fileName: file.name });
  }

  private async sendVaultImage(file: TFile, caption?: string): Promise<void> {
    const mimetype = imageMimetype(file.extension);
    if (!mimetype) return void new Notice("Solo se pueden adjuntar imágenes");
    const data = await this.app.vault.readBinary(file);
    await this.sendImage({ base64: arrayBufferToBase64(data), mimetype, fileName: file.name }, caption);
  }

  private async sendQr(customer: NoteRecord): Promise<void> {
    const path = this.plugin.settings.qrPath;
    const file = path ? this.app.vault.getFileByPath(path) : null;
    if (!file) {
      new Notice(path ? `No se encontró el QR (${path}). Elegilo de nuevo en la configuración.` : "Configurá el QR de pago en los ajustes del plugin.");
      return;
    }
    await this.sendVaultImage(file, qrCaption(this.plugin.settings.qrCaption, customer.basename));
  }
}

class ImagePreviewModal extends Modal {
  constructor(
    app: ItemView["app"],
    private readonly url: string,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("cw-preview-modal");
    this.contentEl.createEl("img", { attr: { src: this.url, alt: "Imagen del chat" } });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function shortTime(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

function dayLabel(timestamp: number): string {
  const label = shortTime(timestamp);
  return label.includes(":") ? "Hoy" : label;
}
