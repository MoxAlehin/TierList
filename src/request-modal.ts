import { App, Modal, Setting, TextComponent, TextAreaComponent } from 'obsidian';
import { getAPI } from "obsidian-dataview";

export class DataviewSearchModal extends Modal {
    private from: string = '';
    private where: string = "";
    private resultsContainer: HTMLElement;
    private foundFiles: string[] = [];
    private onApply: (files: string[], from: string, where: string) => void;
    private countComponent: TextComponent;
    private resultAreaComponent: TextAreaComponent;

    constructor(app: App, from: string, where: string, onApply: (names: string[], from: string, where: string) => void) {
        super(app);
        this.onApply = onApply;
        this.from = from;
        this.where = where;
        if (from || where)
            this.searchFiles();
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.setTitle("Dataview file search");

        // Поле FROM
        new Setting(contentEl)
            .setName("From")
            .addText(text => {
                text.setValue(this.from)
                text.onChange(value => this.from = value)
            });

        // Поле WHERE
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

        // Кнопки управления
        new Setting(contentEl)
            .addButton(btn => 
                btn
                    .setIcon("refresh-ccw")
                    .setCta()
                    .onClick(() => this.searchFiles())
            )
            .addButton(btn => 
                btn
                    .setIcon("check")
                    .setCta()
                    .onClick(() => {
                        this.searchFiles();
                        this.close();
                        this.onApply(this.foundFiles, this.from, this.where);
                    })
            );
    }

    async searchFiles() {
        const dv = getAPI();
        if (!dv) {
            this.resultsContainer.setText("Dataview API not found.");
            return;
        }

        try {
            let query = `LIST FROM ${this.from}`;
            if (this.where) query += ` WHERE ${this.where}`;

            // const result = dv.pages(this.from);
            const result = await dv.query(query);
            
            this.foundFiles = result.value.values.map((p: { path: any; }) => dv.page(p.path).file.name);
            this.countComponent.setValue(`${this.foundFiles.length}`)

            this.resultAreaComponent.setValue(this.foundFiles.join("\n"))

        } catch (error) {
            this.resultsContainer.setText(`Error: ${error.message}`);
        }
    }
}