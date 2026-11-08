# WhatsApp Client

Obsidian plugin for a retail sales vault. It embeds a WhatsApp client (through [Evolution API](https://github.com/EvolutionAPI/evolution-api) 2.3.x) and replaces the Templater templates with plugin commands. Works on desktop, phones and tablets.

## Install

```sh
pnpm install
pnpm run deploy      # builds and copies main.js, manifest.json, styles.css into the vault
```

The vault defaults to `../Complices`; set `OBSIDIAN_VAULT=/path/to/vault` to use another one. Then enable **WhatsApp Client** in *Settings → Community plugins*.

## Settings

| Setting | Meaning |
|---|---|
| URL del servidor, Instancia, API key | Evolution API connection. "Probar" checks the instance state. |
| Código de país | Prepended to local phones (`70000001` → `59170000001`) to match chats with customers. Default `591`. |
| Actualizar chats cada | Polling interval while the WhatsApp view is open (minimum 5 s). |
| QR de pago | Vault image sent by **Enviar QR**. |
| Texto que acompaña al QR | Optional caption; `{nombre}` becomes the customer's name. |

The API key is stored in the plugin's `data.json`. If the vault is synced (Self-hosted LiveSync), enable end-to-end encryption.

## Commands

- **Abrir WhatsApp** (also the ribbon icon): chat list, conversation and contact panel. On narrow screens one pane is shown at a time.
- **Nuevo cliente**, **Nuevo pedido**, **Nueva prenda**, **Nuevo fardo**: write the same notes the old templates wrote.

## WhatsApp view

- Chats refresh every N seconds only while the view is open. Images load on demand and are kept in memory, never written to the vault.
- **Adjuntar** (paperclip): send an image from the device (gallery or camera on mobile) or from the vault. The text in the message box is sent as its caption.
- Contact panel, chosen by the chat's phone:
  - Not a customer: **Crear cliente** (name and phone prefilled) or **Vincular a cliente existente** (stores this phone on that customer, asking before replacing another phone).
  - Customer: **Nuevo pedido** (customer fixed), **Enviar QR**, and the customer's orders.
- Chats with a LID (`…@lid`, WhatsApp's anonymous identifier) use the phone in `remoteJidAlt` when WhatsApp shares it. When it does not, creating or linking the customer stores the LID in the `WhatsApp LID` property, so the chat recognizes the customer afterwards.
- Nothing is written to the vault automatically: every note is created by a button, so several synced devices never create duplicates.

## Development

```sh
pnpm test            # domain tests (vitest)
pnpm build           # typecheck + production bundle
pnpm dev             # watch mode
```

Domain services (`src/customers`, `src/orders`, `src/catalog`) depend only on `VaultPort`; the Evolution client depends only on `HttpPort`. Obsidian adapters live in `src/shared/obsidian-vault.ts` and `src/whatsapp/obsidian-http.ts`.
