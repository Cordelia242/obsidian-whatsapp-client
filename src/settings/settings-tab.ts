import { type App, Notice, PluginSettingTab, Setting } from "obsidian";
import { FileSuggestModal, IMAGE_EXTENSIONS } from "../shared/file-suggest-modal";
import type WhatsAppClientPlugin from "../main";
import { MIN_POLL_SECONDS } from "./settings";

export class WhatsAppClientSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: WhatsAppClientPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.plugin.settings;
    containerEl.empty();

    new Setting(containerEl).setName("Conexión · Evolution API").setHeading();

    new Setting(containerEl)
      .setName("URL del servidor")
      .setDesc("Por ejemplo https://evo.tu-dominio.com. Usá siempre HTTPS.")
      .addText((text) =>
        text.setPlaceholder("https://").setValue(settings.baseUrl).onChange(async (value) => {
          settings.baseUrl = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName("Instancia").addText((text) =>
      text.setValue(settings.instance).onChange(async (value) => {
        settings.instance = value.trim();
        await this.plugin.saveSettings();
      }),
    );

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Se guarda en la configuración del plugin. Si usás LiveSync, activá el cifrado de extremo a extremo.")
      .addText((text) => {
        text.inputEl.type = "password";
        text.setValue(settings.apiKey).onChange(async (value) => {
          settings.apiKey = value.trim();
          await this.plugin.saveSettings();
        });
      });

    const status = new Setting(containerEl).setName("Probar conexión").setDesc("Consulta el estado de la instancia.");
    status.addButton((button) =>
      button.setButtonText("Probar").onClick(async () => {
        button.setDisabled(true);
        try {
          const state = await this.plugin.evolution.connectionState();
          status.setDesc(state === "open" ? "Conectado · estado de la instancia: open" : `Estado de la instancia: ${state}`);
        } catch (error) {
          status.setDesc(`Error: ${(error as Error).message}`);
        } finally {
          button.setDisabled(false);
        }
      }),
    );

    new Setting(containerEl)
      .setName("Código de país")
      .setDesc("Se agrega a los teléfonos locales para encontrar al cliente de cada chat.")
      .addText((text) =>
        text.setValue(settings.countryCode).onChange(async (value) => {
          settings.countryCode = value.replace(/\D/g, "");
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Actualizar chats cada (segundos)")
      .setDesc(`Solo mientras la vista de WhatsApp está abierta. Mínimo ${MIN_POLL_SECONDS}.`)
      .addText((text) =>
        text.setValue(String(settings.pollSeconds)).onChange(async (value) => {
          const seconds = Number(value);
          if (!Number.isFinite(seconds) || seconds < MIN_POLL_SECONDS) return;
          settings.pollSeconds = Math.round(seconds);
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName("Pagos").setHeading();

    const qr = new Setting(containerEl)
      .setName("QR de pago")
      .setDesc(settings.qrPath ? settings.qrPath : "Ninguna imagen elegida. El botón \"Enviar QR\" la envía al chat.");
    qr.addButton((button) =>
      button.setButtonText(settings.qrPath ? "Cambiar…" : "Elegir…").onClick(() => {
        new FileSuggestModal(this.app, IMAGE_EXTENSIONS, async (file) => {
          settings.qrPath = file.path;
          await this.plugin.saveSettings();
          this.display();
        }, "Elegí la imagen del QR de pago").open();
      }),
    );
    if (settings.qrPath) {
      qr.addExtraButton((button) =>
        button.setIcon("x").setTooltip("Quitar").onClick(async () => {
          settings.qrPath = "";
          await this.plugin.saveSettings();
          this.display();
        }),
      );
      const file = this.app.vault.getFileByPath(settings.qrPath);
      if (file) {
        qr.controlEl.prepend(
          createEl("img", { cls: "cw-qr-preview", attr: { src: this.app.vault.getResourcePath(file), alt: "Vista previa del QR" } }),
        );
      } else {
        qr.setDesc(`No se encontró ${settings.qrPath}. Elegí otra imagen.`);
      }
    }

    new Setting(containerEl)
      .setName("Texto que acompaña al QR")
      .setDesc("Opcional. {nombre} se reemplaza por el nombre del cliente.")
      .addTextArea((text) =>
        text.setValue(settings.qrCaption).onChange(async (value) => {
          settings.qrCaption = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}
