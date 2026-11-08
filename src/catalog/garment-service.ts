import { requireNewName } from "../shared/new-note-name";
import { link, numberOrText, sortedUnique, unlink } from "../shared/notes";
import type { NoteRecord, VaultPort } from "../shared/vault-port";

export const GARMENT_CATEGORY = "Prenda";
export const GARMENT_FOLDER = "Prendas";

export interface NewGarment {
  name: string;
  type?: string;
  details?: string;
  price: string | number;
  /** Name of an existing bale note. */
  bale: string;
}

export class GarmentService {
  constructor(
    private readonly vault: VaultPort,
    private readonly options: { today: () => string },
  ) {}

  all(): NoteRecord[] {
    return this.vault.notesByCategory(GARMENT_CATEGORY).sort((a, b) => a.basename.localeCompare(b.basename));
  }

  types(): string[] {
    return sortedUnique(this.all().map((n) => unlink(n.frontmatter.Tipo)));
  }

  async create(input: NewGarment): Promise<NoteRecord> {
    const name = requireNewName(this.vault, GARMENT_FOLDER, input.name, "prenda");
    const bale = input.bale.trim();
    if (!bale) throw new Error("Elegí un fardo");
    const type = input.type?.trim();
    return this.vault.createNote({
      folder: GARMENT_FOLDER,
      basename: name,
      frontmatter: {
        Categoria: link(GARMENT_CATEGORY),
        Tipo: type ? link(type) : "",
        Detalles: input.details?.trim() ?? "",
        Precio: numberOrText(input.price),
        Fardo: link(bale),
        fecha: this.options.today(),
      },
      body: "",
    });
  }
}
