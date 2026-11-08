export interface PluginSettings {
  baseUrl: string;
  instance: string;
  apiKey: string;
  /** Prepended to local phone numbers when matching chats to customers. */
  countryCode: string;
  /** Chat refresh interval while the WhatsApp view is open. */
  pollSeconds: number;
  /** Vault path of the payment QR image sent with "Enviar QR". */
  qrPath: string;
  /** Caption sent with the QR; `{nombre}` becomes the customer's name. */
  qrCaption: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  baseUrl: "",
  instance: "",
  apiKey: "",
  countryCode: "591",
  pollSeconds: 10,
  qrPath: "",
  qrCaption: "Hola {nombre}, te paso el QR para realizar el pago.",
};

export const MIN_POLL_SECONDS = 5;
