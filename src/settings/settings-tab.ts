import { type App, PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import { IMAGE_EXTENSIONS } from "../shared/file-suggest-modal";
import type WhatsAppClientPlugin from "../main";
import { MIN_POLL_SECONDS } from "./settings";

/** Declarative settings tab, so every setting also shows up in Obsidian's settings search. */
export class WhatsAppClientSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: WhatsAppClientPlugin,
  ) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "group",
        heading: "Conexión · Evolution API",
        items: [
          {
            name: "URL del servidor",
            desc: "Por ejemplo https://evo.tu-dominio.com. Usá siempre HTTPS.",
            control: {
              type: "text",
              key: "baseUrl",
              placeholder: "https://",
              validate: (value) => (value && !/^https?:\/\//.test(value.trim()) ? "Tiene que empezar con https://" : undefined),
            },
          },
          { name: "Instancia", control: { type: "text", key: "instance" } },
          {
            name: "API key",
            desc: "Se guarda en la configuración del plugin. Si usás LiveSync, activá el cifrado de extremo a extremo.",
            aliases: ["apikey", "clave"],
            render: (setting) => {
              setting.addText((text) => {
                text.inputEl.type = "password";
                text.setValue(this.plugin.settings.apiKey).onChange(async (value) => {
                  this.plugin.settings.apiKey = value.trim();
                  await this.plugin.saveSettings();
                });
              });
            },
          },
          {
            name: "Probar conexión",
            desc: "Consulta el estado de la instancia.",
            render: (setting) => {
              setting.addButton((button) =>
                button.setButtonText("Probar").onClick(async () => {
                  button.setDisabled(true);
                  try {
                    const state = await this.plugin.evolution.connectionState();
                    setting.setDesc(state === "open" ? "Conectado · estado de la instancia: open" : `Estado de la instancia: ${state}`);
                  } catch (error) {
                    setting.setDesc(`Error: ${(error as Error).message}`);
                  } finally {
                    button.setDisabled(false);
                  }
                }),
              );
            },
          },
          {
            name: "Código de país",
            desc: "Se agrega a los teléfonos locales para encontrar al cliente de cada chat.",
            control: {
              type: "text",
              key: "countryCode",
              validate: (value) => (/^\d{1,4}$/.test(value.trim()) ? undefined : "Solo números, por ejemplo 591"),
            },
          },
          {
            name: "Actualizar chats cada (segundos)",
            desc: `Solo mientras la vista de WhatsApp está abierta. Mínimo ${MIN_POLL_SECONDS}.`,
            control: {
              type: "number",
              key: "pollSeconds",
              min: MIN_POLL_SECONDS,
              step: 1,
              validate: (value) => (value >= MIN_POLL_SECONDS ? undefined : `El mínimo es ${MIN_POLL_SECONDS}`),
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Pagos",
        items: [
          {
            name: "QR de pago",
            desc: "Imagen de la bóveda que se envía con el botón \"Enviar QR\".",
            control: {
              type: "file",
              key: "qrPath",
              placeholder: "Buscá la imagen del QR",
              filter: (file) => IMAGE_EXTENSIONS.includes(file.extension.toLowerCase()),
              validate: (value) => (value && !this.app.vault.getFileByPath(value) ? `No se encontró ${value}` : undefined),
            },
          },
          {
            name: "Vista previa del QR",
            searchable: false,
            visible: () => Boolean(this.app.vault.getFileByPath(this.plugin.settings.qrPath)),
            render: (setting) => {
              const file = this.app.vault.getFileByPath(this.plugin.settings.qrPath);
              if (!file) return;
              setting.controlEl.createEl("img", {
                cls: "cw-qr-preview",
                attr: { src: this.app.vault.getResourcePath(file), alt: "Vista previa del QR" },
              });
            },
          },
          {
            name: "Texto que acompaña al QR",
            desc: "Opcional. {nombre} se reemplaza por el nombre del cliente.",
            control: { type: "textarea", key: "qrCaption", rows: 3 },
          },
        ],
      },
    ];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    await super.setControlValue(key, typeof value === "string" ? value.trim() : value);
    // The preview row depends on the chosen QR file.
    if (key === "qrPath") this.update();
  }
}
