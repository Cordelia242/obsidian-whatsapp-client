import { type App, FuzzySuggestModal, type TFile } from "obsidian";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

/** Fuzzy picker over vault files with the given extensions. */
export class FileSuggestModal extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly extensions: string[],
    private readonly onChoose: (file: TFile) => void,
    placeholder = "Buscá un archivo de la bóveda",
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles().filter((f) => this.extensions.includes(f.extension.toLowerCase()));
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
  }
}
