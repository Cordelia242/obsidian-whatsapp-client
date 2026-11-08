import { type App, TFile, normalizePath, stringifyYaml } from "obsidian";
import type { CreateNoteInput, NoteRecord, VaultPort } from "./vault-port";

/** VaultPort backed by the Obsidian vault and its metadata cache. */
export class ObsidianVault implements VaultPort {
  constructor(private readonly app: App) {}

  notesByCategory(category: string): NoteRecord[] {
    const wanted = `[[${category}]]`;
    return this.app.vault
      .getMarkdownFiles()
      .map((file) => ({ file, frontmatter: this.app.metadataCache.getFileCache(file)?.frontmatter }))
      .filter(({ frontmatter }) => frontmatter?.Categoria === wanted)
      .map(({ file, frontmatter }) => ({ path: file.path, basename: file.basename, frontmatter: { ...frontmatter } }));
  }

  exists(path: string): boolean {
    return this.app.vault.getAbstractFileByPath(normalizePath(path)) !== null;
  }

  async createNote(input: CreateNoteInput): Promise<NoteRecord> {
    const folder = normalizePath(input.folder);
    if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
    const content = `---\n${stringifyYaml(input.frontmatter)}---\n${input.body}\n`;
    const file = await this.app.vault.create(normalizePath(`${folder}/${input.basename}.md`), content);
    return { path: file.path, basename: file.basename, frontmatter: { ...input.frontmatter } };
  }

  frontmatterOf(path: string): Record<string, unknown> | null {
    const file = this.file(path);
    if (!file) return null;
    return { ...(this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) };
  }

  async updateFrontmatter(path: string, change: (frontmatter: Record<string, unknown>) => void): Promise<void> {
    const file = this.file(path);
    if (!file) throw new Error(`No se encontró ${path}`);
    await this.app.fileManager.processFrontMatter(file, change);
  }

  file(path: string): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    return file instanceof TFile ? file : null;
  }
}
