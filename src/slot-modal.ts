import { App, Modal, Setting, ColorComponent, TextComponent, DropdownComponent, ToggleComponent, ButtonComponent } from 'obsidian';
import { FileSuggest } from 'suggesters/file-suggester';

enum InputType {
    Text = "Text",
    InternalEmbed = "Internal Embed",
    InternalLink = "Internal Link / Cover",
    ExternalEmbed = "External Embed",
    ExternalLink = "External Link"
}

class ParsedInput {
    value: string;
    alias?: string;
    type: InputType;
    defaultColor: string = getComputedStyle(document.body).getPropertyValue("--background-secondary");
    color: string = this.defaultColor;
    useCustomColor: boolean;
    isUseTab: boolean;

    constructor(rawValue: string) {
        this.isUseTab = rawValue.startsWith("\t");
        if (this.isUseTab) {
            rawValue = rawValue.trimStart();
        }

        rawValue = rawValue.slice(2);

        const colorMatch = rawValue.match(/<span style="background-color:\s*([^">]+);">(.+?)<\/span>/);
        if (colorMatch) {
            this.color = colorMatch[1];
            rawValue = colorMatch[2];
        }

        const internalEmbedMatch = rawValue.match(/!\[\[(.*?)(?:\|(.*?))?\]\]/);
        const internalLinkMatch  =  rawValue.match(/\[\[(.*?)(?:\|(.*?))?\]\]/);
        const externalEmbedMatch = rawValue.match(/!\[(.*?)\]\((.*?)\)/);
        const externalLinkMatch  =  rawValue.match(/\[(.*?)\]\((.*?)\)/);

        if (internalEmbedMatch) {
            this.type = InputType.InternalEmbed;
            this.value = internalEmbedMatch[1];
            this.alias = internalEmbedMatch[2];
        } else if (internalLinkMatch) {
            this.type = InputType.InternalLink;
            this.value = internalLinkMatch[1];
            this.alias = internalLinkMatch[2];
        } else if (externalEmbedMatch) {
            this.type = InputType.ExternalEmbed;
            this.alias = externalEmbedMatch[1];
            this.value = externalEmbedMatch[2];
        } else if (externalLinkMatch) {
            this.type = InputType.ExternalLink;
            this.alias = externalLinkMatch[1];
            this.value = externalLinkMatch[2];
        } else {
            this.type = InputType.Text;
            this.value = rawValue;
        }

        this.value = this.value.trim()
        if (this.alias)
            this.alias = this.alias.trim()

        this.useCustomColor = this.color !== this.defaultColor;
    }

    toString(): string {
        let output = "";

        switch (this.type) {
            case InputType.InternalEmbed:
                output = `![[${this.value}${this.alias ? ` | ${this.alias}` : ""}]]`;
                break;
            case InputType.InternalLink:
                output = `[[${this.value}${this.alias ? ` | ${this.alias}` : ""}]]`;
                break;
            case InputType.ExternalEmbed:
                output = `![${this.alias || ""}](${this.value})`;
                break;
            case InputType.ExternalLink:
                output = `[${this.alias || ""}](${this.value})`;
                break;
            case InputType.Text:
            default:
                output = this.value;
                break;
        }

        if (this.useCustomColor && this.defaultColor != this.color) {
            output = `<span style="background-color:${this.color};">${output}</span>`;
        }

        output = `${this.isUseTab ? "\t" : ""}- ${output}`;

        return output;
    }
}

export class SlotModal extends Modal {
    private colorPicker: ColorComponent;
    private value: ParsedInput;
    private valueComponent: TextComponent;
    private typeSetting: DropdownComponent;
    private aliasSetting: TextComponent;
    private useTabSetting: ButtonComponent;
    private valueSetting: Setting;

    updateSettings() {
        this.valueSetting
            .clear()
            .setName("Value")
            .addText((text) => {
                if (this.value.type == InputType.InternalEmbed || this.value.type == InputType.InternalLink) {
                    try {
                        new FileSuggest(this.app, text.inputEl);
                    } catch (e) {
                        console.error(e);
                    }
                }
                this.valueComponent = text;
                text.setValue(this.value.value);
                text.onChange((value) => {
                    this.value.value = value;
                });
            });
        
        if (this.value.type == InputType.Text) {
            this.aliasSetting.setValue("");
            this.aliasSetting.setDisabled(true);
        }
        else {
            this.aliasSetting.setValue(this.value.alias || '');
            this.aliasSetting.setDisabled(false);
        }
    }

    constructor(app: App, header: string, value: string, onSubmit: (result: string) => void) {
        super(app);
        this.containerEl.addClass("tier-list-slot-modal");

        this.value = new ParsedInput(value);

        this.setTitle(header);

        const onSubmitHandler = () => {
            this.close();
            onSubmit(this.value.toString());
        };

        // Use Tab setting
        new Setting(this.contentEl)
            .addButton((btn) => {
                this.useTabSetting = btn;
                btn.setButtonText(this.value.isUseTab ? 'Record' : 'Tier');
                btn.onClick(() => {
                    this.value.isUseTab = !this.value.isUseTab;
                    btn.setButtonText(this.value.isUseTab ? 'Record' : 'Tier');
                });
            })

        // Type setting
        new Setting(this.contentEl)
            .setName("Type")
            .addDropdown((dropdown) => {
                this.typeSetting = dropdown;
                Object.values(InputType).forEach((type) => {
                    dropdown.addOption(type, type);
                });
        
                dropdown.setValue(this.value.type);
        
                dropdown.onChange((value) => {
                    this.value.type = value as InputType;
                    this.updateSettings();
                })
            });

        // Value setting
        this.valueSetting = new Setting(this.contentEl);

        // Alias setting
        new Setting(this.contentEl)
            .setName("Alias")
            .addText((text) => {
                this.aliasSetting = text;
                text
                    .setValue(this.value.alias || '')
                    .onChange((value) => {
                        this.value.alias = value;
                    })
            });

        // Color settings
        new Setting(this.contentEl)
            .setName("Color")
            .addColorPicker(picker => {
                picker.setValue(this.value.color);
                this.colorPicker = picker;
                picker.setDisabled(!this.value.useCustomColor);
                picker.onChange((value) => {
                    this.value.color = value;
            })})
            .addToggle(toggle =>
                toggle
                    .setValue(this.value.useCustomColor)
                    .onChange(val => {
                        this.value.useCustomColor = val;
                        const tempColor = this.value.color;
                        this.colorPicker.setValue(val ? this.value.color : this.value.defaultColor)
                        this.value.color = tempColor;
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

        this.updateSettings();
        
        this.onOpen = () => {
            setTimeout(() => {
                this.valueComponent.inputEl.focus();
                this.valueComponent.inputEl.select();
            }, 0);
        };
    }
}