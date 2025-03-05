import { App, TAbstractFile, AbstractInputSuggest } from 'obsidian';

export class FileInputSuggest extends AbstractInputSuggest<string> {
    app: App;
    inputEl: HTMLInputElement;
    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.app = app;
        this.inputEl = inputEl;
    }

    getSuggestions(query: string): string[] {
        const files = this.app.vault.getFiles();
        return files
            .filter((file: TAbstractFile) => {
                return file.name.toLowerCase().includes(query.toLowerCase());
            })
            .map((file: TAbstractFile) => {
                const fileName = file.name;
                if (fileName.toLowerCase().endsWith('.md')) {
                    return fileName.slice(0, -3);
                }
                return fileName;
            });
    }

    renderSuggestion(suggestion: string, el: HTMLElement): void {
        el.createEl('div', { text: suggestion });
    }

    selectSuggestion(suggestion: string): void {
        this.inputEl.value = suggestion;
        this.inputEl.trigger('input');
        this.close();
    }
}