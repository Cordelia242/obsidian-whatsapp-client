import type { CreateNoteInput, NoteRecord, VaultPort } from "../../src/shared/vault-port";

/** In-memory VaultPort used by domain tests. */
export class InMemoryVault implements VaultPort {
  readonly notes = new Map<string, NoteRecord & { body: string }>();

  seed(path: string, frontmatter: Record<string, unknown>, body = ""): void {
    const basename = path.split("/").pop()!.replace(/\.md$/, "");
    this.notes.set(path, { path, basename, frontmatter, body });
  }

  notesByCategory(category: string): NoteRecord[] {
    return [...this.notes.values()].filter((n) => n.frontmatter.Categoria === `[[${category}]]`);
  }

  exists(path: string): boolean {
    return this.notes.has(path);
  }

  async createNote(input: CreateNoteInput): Promise<NoteRecord> {
    const path = `${input.folder}/${input.basename}.md`;
    if (this.notes.has(path)) throw new Error(`File already exists: ${path}`);
    const note = { path, basename: input.basename, frontmatter: { ...input.frontmatter }, body: input.body };
    this.notes.set(path, note);
    return note;
  }

  frontmatterOf(path: string): Record<string, unknown> | null {
    return this.notes.get(path)?.frontmatter ?? null;
  }

  async updateFrontmatter(path: string, change: (frontmatter: Record<string, unknown>) => void): Promise<void> {
    const note = this.notes.get(path);
    if (!note) throw new Error(`File not found: ${path}`);
    change(note.frontmatter);
  }
}
