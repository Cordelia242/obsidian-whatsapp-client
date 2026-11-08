/** Caption sent with the payment QR: `{nombre}` becomes the customer's name. */
export function qrCaption(template: string, customerName: string): string {
  return template.trim() ? template.split("{nombre}").join(customerName).trim() : "";
}
