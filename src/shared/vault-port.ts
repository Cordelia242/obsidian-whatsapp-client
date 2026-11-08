export type Frontmatter = Record<string, unknown>;

/** A markdown note as the domain sees it: where it is and its properties. */
export interface NoteRecord {
  path: string;
  basename: string;
  frontmatter: Frontmatter;
}

export interface CreateNoteInput {
  folder: string;
  basename: string;
  frontmatter: Frontmatter;
  body: string;
}

/** Port between the domain services and the vault (Obsidian in production, in-memory in tests). */
export interface VaultPort {
  /** Notes whose `Categoria` property is a link to the given category, e.g. "Cliente". */
  notesByCategory(category: string): NoteRecord[];
  exists(path: string): boolean;
  /** Creates the folder when missing. Frontmatter keys are written in insertion order. */
  createNote(input: CreateNoteInput): Promise<NoteRecord>;
  /** Current frontmatter of a note, or null when the note does not exist. */
  frontmatterOf(path: string): Frontmatter | null;
  /** Changes properties in place; other properties and the body are kept. */
  updateFrontmatter(path: string, change: (frontmatter: Frontmatter) => void): Promise<void>;
}
