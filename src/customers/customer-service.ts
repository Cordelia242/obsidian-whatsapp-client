import { scalarText } from "../shared/json";
import { requireNewName } from "../shared/new-note-name";
import { link, sortedUnique, unlink } from "../shared/notes";
import type { NoteRecord, VaultPort } from "../shared/vault-port";
import { localPhone, normalizePhone } from "./phone";

export const CUSTOMER_CATEGORY = "Cliente";
export const CUSTOMER_FOLDER = "Clientes";
const CUSTOMER_BODY = "![[Pedidos Base.base#Pedidos por Cliente]]";

/** Property that stores a chat's LID when WhatsApp does not share the phone number. */
export const LID_PROPERTY = "WhatsApp LID";

export interface NewCustomer {
  name: string;
  /** Any format: local, "+591 …", or international digits from a WhatsApp JID. */
  phone?: string;
  city?: string;
  /** "…@lid" address of a chat whose number WhatsApp hides; stored so the chat finds the customer. */
  lid?: string;
}

/** What identifies a WhatsApp chat as a person. */
export interface ChatIdentity {
  phone: string | null;
  lid?: string | null;
}

export interface CustomerServiceOptions {
  countryCode: () => string;
  today: () => string;
}

export class CustomerService {
  constructor(
    private readonly vault: VaultPort,
    private readonly options: CustomerServiceOptions,
  ) {}

  all(): NoteRecord[] {
    return this.vault
      .notesByCategory(CUSTOMER_CATEGORY)
      .sort((a, b) => a.basename.localeCompare(b.basename));
  }

  /** Every customer with this phone. More than one is possible (shared phones). */
  findByPhone(phone: string): NoteRecord[] {
    const countryCode = this.options.countryCode();
    const wanted = normalizePhone(phone, countryCode);
    if (!wanted) return [];
    return this.all().filter((n) => normalizePhone(n.frontmatter.Telefono, countryCode) === wanted);
  }

  cities(): string[] {
    return sortedUnique(this.all().map((n) => unlink(n.frontmatter.Ciudad)));
  }

  /** Customers of a chat: by phone when WhatsApp shares it, or by the LID stored on the note. */
  findByChat(chat: ChatIdentity): NoteRecord[] {
    const byPhone = chat.phone ? this.findByPhone(chat.phone) : [];
    const byLid = chat.lid ? this.all().filter((n) => n.frontmatter[LID_PROPERTY] === chat.lid) : [];
    return [...new Map([...byPhone, ...byLid].map((n) => [n.path, n])).values()];
  }

  /**
   * Links a chat to an existing customer: stores its phone when known, otherwise its LID.
   * Returns the phone it replaced ("" if none or unchanged).
   */
  async linkChat(customerPath: string, chat: ChatIdentity): Promise<string> {
    const frontmatter = this.vault.frontmatterOf(customerPath);
    if (frontmatter?.Categoria !== link(CUSTOMER_CATEGORY)) throw new Error(`No es un cliente: ${customerPath}`);
    const countryCode = this.options.countryCode();
    const phone = normalizePhone(chat.phone, countryCode);
    if (!phone && !chat.lid) throw new Error("Este chat no tiene teléfono ni LID para vincular");

    const previous = phone ? scalarText(frontmatter.Telefono) : "";
    await this.vault.updateFrontmatter(customerPath, (fm) => {
      if (phone) fm.Telefono = localPhone(phone, countryCode);
      else fm[LID_PROPERTY] = chat.lid;
    });
    return previous;
  }

  async create(input: NewCustomer): Promise<NoteRecord> {
    const name = requireNewName(this.vault, CUSTOMER_FOLDER, input.name, "cliente");
    const countryCode = this.options.countryCode();
    const phone = normalizePhone(input.phone, countryCode);
    const city = input.city?.trim();

    return this.vault.createNote({
      folder: CUSTOMER_FOLDER,
      basename: name,
      frontmatter: {
        Categoria: link(CUSTOMER_CATEGORY),
        Ciudad: city ? link(city) : "",
        Telefono: phone ? localPhone(phone, countryCode) : "",
        // Only for chats where WhatsApp hides the number; lets the chat find this customer again.
        ...(input.lid ? { [LID_PROPERTY]: input.lid } : {}),
        fecha: this.options.today(),
      },
      body: CUSTOMER_BODY,
    });
  }
}
