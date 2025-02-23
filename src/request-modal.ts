import { App, Modal, Setting, TextComponent, TextAreaComponent } from 'obsidian';
import { searchFiles } from 'post-processor';

export class DataviewSearchModal extends Modal {
    private from: string = '';
    private where: string = "";
    private foundFiles: string[] = [];
    private onApply: (files: string[], from: string, where: string) => void;
    private countComponent: TextComponent;
    private resultAreaComponent: TextAreaComponent;

    constructor(app: App, from: string, where: string, onApply: (names: string[], from: string, where: string) => void) {
        super(app);
        this.onApply = onApply;
        this.from = from;
        this.where = where;
        if (from)
            this.updateFiles();
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.setTitle("Dataview file search");

        new Setting(contentEl)
            .setName("From")
            .addText(text => {
                text.setValue(this.from)
                text.onChange(value => this.from = value)
            });

        new Setting(contentEl)
            .setName("Where")
            .addText(text => {
                text.setValue(this.where)
                text.onChange(value => this.where = value)
            });

        new Setting(this.contentEl)
            .setName("Count")
            .addText(text => {
                this.countComponent = text;
                text.setValue("0");
                text.inputEl.readOnly = true;
            });

        new Setting(this.contentEl)
            .setName("Files")
            .setClass("tier-list-query")
            .addTextArea(textArea => {
                this.resultAreaComponent = textArea;
                textArea.inputEl.readOnly = true;
                textArea.inputEl.rows = 5;
                textArea.inputEl.cols = 40;
            });

        new Setting(contentEl)
            .addButton(btn => 
                btn
                    .setIcon("refresh-ccw")
                    .setCta()
                    .onClick(() => this.updateFiles())
            )
            .addButton(btn => 
                btn
                    .setIcon("check")
                    .setCta()
                    .onClick(() => {
                        this.updateFiles();
                        this.close();
                        this.onApply(this.foundFiles, this.from, this.where);
                    })
            );
    }

    async updateFiles() {
        this.foundFiles = await searchFiles(this.from, this.where)
        this.countComponent.setValue(`${this.foundFiles.length}`)
        this.resultAreaComponent.setValue(this.foundFiles.join("\n"))
    }
}