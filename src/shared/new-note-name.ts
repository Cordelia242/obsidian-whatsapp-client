import { sanitizeBasename } from "./notes";
import type { VaultPort } from "./vault-port";

/**
 * Validates the name of a note about to be created in `folder`.
 * `label` completes the duplicate message: "Ya existe un <label> llamado ...".
 */
export function requireNewName(vault: VaultPort, folder: string, raw: string, label: string): string {
  const name = sanitizeBasename(raw);
  if (!name) throw new Error("El nombre no puede estar vacío");
  if (vault.exists(`${folder}/${name}.md`)) throw new Error(`Ya existe un ${label} llamado "${name}"`);
  return name;
}
