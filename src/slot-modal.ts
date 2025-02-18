import { App, Modal, Setting, ButtonComponent, ColorComponent, TextComponent } from 'obsidian';

enum InputType {
    Text = "Text",
    Internal = "Internal",
    URL = "Url",
    Link = "Link"
}

export class SlotModal extends Modal {
    private useTab: boolean;
    private defaultColor: string = getComputedStyle(document.body).getPropertyValue("--background-secondary");
    private color: string = this.defaultColor;
    private useCustomColor: boolean = false;
    private colorPicker: ColorComponent;
    private textEl: TextComponent;

    constructor(app: App, header: string, value: string, onSubmit: (result: string) => void) {
        super(app);

        this.useTab = value.startsWith("\t");

        value = value.substring(this.useTab ? 3 : 2);

        const spanRegex = /<span style="background-color:\s*(#[0-9a-fA-F]+);?">(.*?)<\/span>/;
        const match = value.match(spanRegex);

        if (match) {
            this.useCustomColor = true;
            value = match[2],
            this.color = match[1];
        }

        this.setTitle(header);

        const onSubmitHandler = () => {
            this.close();
            onSubmit(this.assembleValue(this.useTab, value, this.color));
        };

        // Value Settings
        new Setting(this.contentEl)
            .setName('Value')
            .addButton((btn) => {
                this.updateSlotButton(btn);
                btn.onClick(() => {
                    this.useTab = !this.useTab;
                    this.updateSlotButton(btn);
                });
            
            })
            // .addDropdown((dropdown) => {
            //     Object.values(InputType).forEach((type) => {
            //         dropdown.addOption(type, type);
            //     });
        
            //     dropdown.setValue(InputType.Text);
        
            //     dropdown.onChange((value) => {
            //         const selectedType = value as InputType;
            //         switch (selectedType) {
            //             case InputType.Text:
            //                 break;
            //             case InputType.Internal:
            //                 break;
            //             case InputType.URL:
            //                 break;
            //         }
            //     })
            // })
            .addText((text) => {
                text.setValue(value);
                this.textEl = text;
                text.onChange((val) => {
                    value = val;
                });
            });

        // Color Settings
        new Setting(this.contentEl)
        .setName("Background color")
        .addColorPicker(picker => {
            picker.setValue(this.color);
            this.colorPicker = picker;
            picker.setDisabled(!this.useCustomColor);
            picker.onChange((value) => {
                this.color = value;
        })})
        .addToggle(toggle =>
            toggle
                .setValue(this.useCustomColor)
                .onChange(val => {
                    this.useCustomColor = val;
                    const tempColor = this.color;
                    this.colorPicker.setValue(val ? this.color : this.defaultColor)
                    this.color = tempColor;
                    this.colorPicker.setDisabled(!val)
                })
        );
        
        // Submit buttons
        new Setting(this.contentEl)
            .addButton((btn) =>
                btn
                    .setIcon("trash-2")
                    .setWarning()
                    .onClick(() => {
                        this.close();
                        onSubmit("");
                    })
            )
            .addButton((btn) =>
                btn
                    .setIcon("check")
                    .setCta()
                    .onClick(onSubmitHandler)
            );
        this.scope.register([], "Enter", (evt) => {
            evt.preventDefault();
            onSubmitHandler();
        });
        
        this.onOpen = () => {
            setTimeout(() => {
                this.textEl.inputEl.focus();
                this.textEl.inputEl.select();
            }, 0);
        };
    }

    private assembleValue(useTab: boolean, value: string, color: string): string {
        const colorStr = `<span style="background-color: ${color};">`;
        return (useTab ? "\t" : "") + "- " + (this.useCustomColor ? colorStr : "") + value + (this.useCustomColor ? "</span>" : "");
    }

    private updateSlotButton(btn: ButtonComponent) {
        btn.setButtonText(this.useTab ? 'Record' : 'Tier');
    }
}