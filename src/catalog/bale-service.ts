import { requireNewName } from "../shared/new-note-name";
import { link, numberOrText } from "../shared/notes";
import type { NoteRecord, VaultPort } from "../shared/vault-port";

export const BALE_CATEGORY = "Fardo";
export const BALE_FOLDER = "Fardo";

export interface NewBale {
  name: string;
  price: string | number;
  quantity: string | number;
}

export class BaleService {
  constructor(
    private readonly vault: VaultPort,
    private readonly options: { today: () => string },
  ) {}

  /** Newest first, as the Prenda template offered them. */
  all(): NoteRecord[] {
    return this.vault.notesByCategory(BALE_CATEGORY).sort((a, b) => {
      const byDate = String(b.frontmatter.fecha ?? "").localeCompare(String(a.frontmatter.fecha ?? ""));
      return byDate || a.basename.localeCompare(b.basename);
    });
  }

  async create(input: NewBale): Promise<NoteRecord> {
    const name = requireNewName(this.vault, BALE_FOLDER, input.name, "fardo");
    return this.vault.createNote({
      folder: BALE_FOLDER,
      basename: name,
      frontmatter: {
        Categoria: link(BALE_CATEGORY),
        fecha: this.options.today(),
        Precio: numberOrText(input.price),
        "Cantidad de Prendas": numberOrText(input.quantity),
      },
      body: "",
    });
  }
}
