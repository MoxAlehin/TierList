// Credits go to Liam's Periodic Notes Plugin: https://github.com/liamcain/obsidian-periodic-notes

import { TAbstractFile, TFile } from 'obsidian';
import { TextInputSuggest } from './suggest';

export class FileSuggest extends TextInputSuggest<TFile> {
    getSuggestions(inputStr: string): TFile[] {
        const abstractFiles = this.app.vault.getAllLoadedFiles();
        const files: TFile[] = [];
        const lowerCaseInputStr = inputStr.toLowerCase();

        abstractFiles.forEach((file: TAbstractFile) => {
            if (file instanceof TFile && file.path.toLowerCase().contains(lowerCaseInputStr)) {
                files.push(file);
            }
        });

        return files;
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
        el.setText(file.path.replace(/\.md$/, ""));
    }

    selectSuggestion(file: TFile): void {
        this.inputEl.value = file.path.replace(/\.md$/, "");
        this.inputEl.trigger('input');
        this.close();
    }
}
