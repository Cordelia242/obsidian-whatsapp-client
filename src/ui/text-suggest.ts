import { AbstractInputSuggest, type App } from "obsidian";

/**
 * Suggestions under a text input. Uses Obsidian's own suggest popover instead of <datalist>,
 * which is unreliable in the Android WebView used by Obsidian mobile.
 */
export class TextSuggest extends AbstractInputSuggest<string> {
  constructor(
    app: App,
    private readonly input: HTMLInputElement,
    private readonly values: () => string[],
  ) {
    super(app, input);
  }

  protected getSuggestions(query: string): string[] {
    const wanted = normalize(query);
    return this.values().filter((v) => normalize(v).includes(wanted));
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    el.setText(value);
  }

  selectSuggestion(value: string): void {
    this.input.value = value;
    this.input.dispatchEvent(new Event("input"));
    this.close();
  }
}

/** Case- and accent-insensitive comparison ("maria" finds "María"). */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
