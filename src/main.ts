import { Plugin } from "obsidian";
import { BaleService } from "./catalog/bale-service";
import { CreateBaleModal } from "./catalog/create-bale-modal";
import { CreateGarmentModal } from "./catalog/create-garment-modal";
import { GarmentService } from "./catalog/garment-service";
import { CreateCustomerModal } from "./customers/create-customer-modal";
import { CustomerService } from "./customers/customer-service";
import { CreateOrderModal } from "./orders/create-order-modal";
import { OrderService } from "./orders/order-service";
import { WhatsAppClientSettingTab } from "./settings/settings-tab";
import { DEFAULT_SETTINGS, type PluginSettings } from "./settings/settings";
import { isoDate } from "./shared/notes";
import { ObsidianVault } from "./shared/obsidian-vault";
import type { NoteRecord } from "./shared/vault-port";
import { EvolutionClient } from "./whatsapp/evolution-client";
import { ObsidianHttp } from "./whatsapp/obsidian-http";
import { WHATSAPP_VIEW_TYPE, WhatsAppView } from "./whatsapp/whatsapp-view";

export default class WhatsAppClientPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };
  vaultAdapter!: ObsidianVault;
  customers!: CustomerService;
  orders!: OrderService;
  garments!: GarmentService;
  bales!: BaleService;
  evolution!: EvolutionClient;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.vaultAdapter = new ObsidianVault(this.app);
    const today = () => isoDate();
    this.customers = new CustomerService(this.vaultAdapter, { countryCode: () => this.settings.countryCode, today });
    this.orders = new OrderService(this.vaultAdapter, { today });
    this.garments = new GarmentService(this.vaultAdapter, { today });
    this.bales = new BaleService(this.vaultAdapter, { today });
    this.evolution = new EvolutionClient(new ObsidianHttp(), () => this.settings);

    this.registerView(WHATSAPP_VIEW_TYPE, (leaf) => new WhatsAppView(leaf, this));
    this.addRibbonIcon("message-circle", "Abrir WhatsApp", () => void this.openWhatsApp());
    this.addCommand({ id: "open-whatsapp", name: "Abrir WhatsApp", callback: () => void this.openWhatsApp() });

    this.registerCreationCommands();
    this.addSettingTab(new WhatsAppClientSettingTab(this.app, this));
  }

  async openWhatsApp(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(WHATSAPP_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: WHATSAPP_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<PluginSettings> | null) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  get orderModalServices() {
    return { orders: this.orders, customers: this.customers, garments: this.garments, bales: this.bales };
  }

  /** Replacements for the Cliente, Pedido, Prenda and Fardo templates. */
  private registerCreationCommands(): void {
    const open = (note: NoteRecord) => {
      const file = this.vaultAdapter.file(note.path);
      if (file) void this.app.workspace.getLeaf(false).openFile(file);
    };
    this.addCommand({
      id: "new-customer",
      name: "Nuevo cliente",
      callback: () => new CreateCustomerModal(this.app, this.customers, {}, open).open(),
    });
    this.addCommand({
      id: "new-order",
      name: "Nuevo pedido",
      callback: () => new CreateOrderModal(this.app, this.orderModalServices, undefined, open).open(),
    });
    this.addCommand({
      id: "new-garment",
      name: "Nueva prenda",
      callback: () => new CreateGarmentModal(this.app, this.garments, this.bales, open).open(),
    });
    this.addCommand({
      id: "new-bale",
      name: "Nuevo fardo",
      callback: () => new CreateBaleModal(this.app, this.bales, open).open(),
    });
  }
}
