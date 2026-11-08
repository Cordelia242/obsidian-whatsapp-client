import { type App, Modal, Notice, Setting } from "obsidian";
import { TextSuggest } from "./text-suggest";

export interface FieldOptions {
  value?: string;
  placeholder?: string;
  description?: string;
  suggestions?: string[];
  readonly?: boolean;
  type?: "text" | "number" | "date";
}

/** Base for the small creation forms: fields as Settings, one submit button, errors as notices. */
export abstract class FormModal extends Modal {
  private submitting = false;

  constructor(
    app: App,
    private readonly heading: string,
    private readonly submitLabel: string,
  ) {
    super(app);
  }

  /** Builds the fields inside `contentEl`. */
  protected abstract buildFields(container: HTMLElement): void;

  /** Creates the note; a thrown Error is shown and the modal stays open. */
  protected abstract submit(): Promise<void>;

  onOpen(): void {
    this.titleEl.setText(this.heading);
    this.buildFields(this.contentEl);
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("Cancelar").onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText(this.submitLabel)
          .setCta()
          .onClick(() => void this.trySubmit()),
      );
    this.contentEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        void this.trySubmit();
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  protected field(container: HTMLElement, label: string, options: FieldOptions = {}): HTMLInputElement {
    let input!: HTMLInputElement;
    const setting = new Setting(container).setName(label).addText((text) => {
      input = text.inputEl;
      input.type = options.type ?? "text";
      text.setValue(options.value ?? "").setPlaceholder(options.placeholder ?? "");
      input.readOnly = options.readonly ?? false;
    });
    if (options.description) setting.setDesc(options.description);
    const suggestions = options.suggestions;
    if (suggestions?.length && !options.readonly) new TextSuggest(this.app, input, () => suggestions);
    return input;
  }

  protected select(container: HTMLElement, label: string, values: string[], selected?: string): HTMLSelectElement {
    let element!: HTMLSelectElement;
    new Setting(container).setName(label).addDropdown((dropdown) => {
      for (const value of values) dropdown.addOption(value, value);
      if (selected) dropdown.setValue(selected);
      element = dropdown.selectEl;
    });
    return element;
  }

  private async trySubmit(): Promise<void> {
    if (this.submitting) return;
    this.submitting = true;
    try {
      await this.submit();
      this.close();
    } catch (error) {
      new Notice((error as Error).message);
    } finally {
      this.submitting = false;
    }
  }
}
