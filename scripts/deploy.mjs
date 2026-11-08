// Copies the build output into the vault's plugin folder.
// Vault path: OBSIDIAN_VAULT env var, or the sibling "Complices" folder by default.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vault = resolve(process.env.OBSIDIAN_VAULT ?? join(root, "..", "Complices"));

if (!existsSync(join(vault, ".obsidian"))) {
  console.error(`Not an Obsidian vault: ${vault}`);
  process.exit(1);
}

const target = join(vault, ".obsidian", "plugins", "whatsapp-client");
mkdirSync(target, { recursive: true });
for (const file of ["main.js", "manifest.json", "styles.css"]) {
  copyFileSync(join(root, file), join(target, file));
}
console.log(`Deployed to ${target}`);
