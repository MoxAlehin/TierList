import TierListPlugin from 'main';
import { App, Modal, Setting, ColorComponent, TextComponent, DropdownComponent, ButtonComponent, MarkdownRenderer, Plugin, SliderComponent } from 'obsidian';
import { TierListSettings } from 'settings';
import { FileSuggest } from 'suggesters/file-suggester';
import { renderSlot } from 'utils/render-utils';
import { redraw } from 'post-processor';

export enum InputType {
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
    x: number = 0;
    y: number = 0;
    rotation: number = 0;
    scale: number = 1;
    customTransform: boolean = false;

    constructor(rawValue: string) {
        this.isUseTab = rawValue.startsWith("\t");
        if (this.isUseTab) {
            rawValue = rawValue.trimStart();
        }

        rawValue = rawValue.slice(2);

        const styleMatch = rawValue.match(/<span style="([^">]+);">(.+?)<\/span>/);
        if (styleMatch) {
            const styleString = styleMatch[1]; // Получаем строку со стилями
            rawValue = styleMatch[2]; // Получаем содержимое внутри <span>

            // Парсим стили
            const styles = styleString.split(";").map(s => s.trim()).filter(s => s);
            for (const style of styles) {
                const [key, value] = style.split(":").map(s => s.trim());
                if (key === "background-color") {
                    this.color = value;
                    this.useCustomColor = true;
                } else if (key === "transform") {
                    this.parseTransform(value);
                    this.customTransform = true;
                }
            }
        }

        const internalEmbedMatch = rawValue.match(/!\[\[(.*?)(?:\|(.*?))?\]\]/);
        const internalLinkMatch = rawValue.match(/\[\[(.*?)(?:\|(.*?))?\]\]/);
        const externalEmbedMatch = rawValue.match(/!\[(.*?)\]\((.*?)\)/);
        const externalLinkMatch = rawValue.match(/\[(.*?)\]\((.*?)\)/);

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

        this.value = this.value.trim();
        if (this.alias) this.alias = this.alias.trim();

        this.useCustomColor = this.color !== this.defaultColor;
    }

    private parseTransform(transformString: string) {
        const translateMatch = transformString.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        const rotateMatch = transformString.match(/rotate\(([-\d.]+)deg\)/);
        const scaleMatch = transformString.match(/scale\(([-\d.]+)\)/);

        if (translateMatch) {
            this.x = parseFloat(translateMatch[1]);
            this.y = parseFloat(translateMatch[2]);
        }
        if (rotateMatch) {
            this.rotation = parseFloat(rotateMatch[1]);
        }
        if (scaleMatch) {
            this.scale = parseFloat(scaleMatch[1]);
        }
    }

    private getTransformStyle(): string {
        return `transform: translate(${this.x}px, ${this.y}px) rotate(${this.rotation}deg) scale(${this.scale});`;
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

        let styles: string[] = [];

        if (this.useCustomColor) {
            styles.push(`background-color:${this.color};`);
        }
        if (this.customTransform) {
            styles.push(this.getTransformStyle());
        }

        if (styles.length > 0) {
            output = `<span style="${styles.join(" ")}">${output}</span>`;
        }

        output = `${this.isUseTab ? "\t" : ""}- ${output}`;

        return output;
    }
}

export class SlotModal extends Modal {
    private colorPicker: ColorComponent;
    private value: ParsedInput;
    private valueComponent: TextComponent;
    private aliasSetting: TextComponent;
    private valueSetting: Setting;
    private plugin: TierListPlugin;
    private settings: TierListSettings;
    private renderEl: HTMLElement;

    async render() {
        const app = this.plugin.app;
        const str = this.value.toString().replace(/^\t/, '');
        this.renderEl.replaceChildren();
        await MarkdownRenderer.render(app, str, this.renderEl, '', this.plugin);
        await renderSlot(this.plugin, this.settings, this.renderEl.find('li'));
    }

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
                    this.render();
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

    constructor(plugin: TierListPlugin, settings: TierListSettings, header: string, value: string, onSubmit: (result: string) => void) {
        const app = plugin.app;
        super(app);
        this.settings = settings;
        this.plugin = plugin;
        const contentEl = this.contentEl;
        contentEl.addClass("tier-list-slot-modal");
        this.renderEl = document.createElement('div');
        this.renderEl.addClass('tier-list');
        this.renderEl.addClass('markdown-rendered');
        this.renderEl.addClass('markdown-preview-view');
        const flexContainerEl = document.createElement('div');
        flexContainerEl.addClass('flex');
        const flexSettingsEl = document.createElement('div');
        flexSettingsEl.addClass('right');

        redraw(this.renderEl, this.settings);

        this.value = new ParsedInput(value);

        this.setTitle(header);

        const onSubmitHandler = () => {
            this.close();
            onSubmit(this.value.toString());
        };

        // Use Tab setting
        new Setting(contentEl)
            .setName('Type')
            .addButton((btn) => {
                btn.setButtonText(this.value.isUseTab ? 'Record' : 'Tier');
                btn.onClick(() => {
                    this.value.isUseTab = !this.value.isUseTab;
                    btn.setButtonText(this.value.isUseTab ? 'Record' : 'Tier');
                    this.render();
                });
            })

        // Type setting
        new Setting(contentEl)
            .setName("Content")
            .addDropdown((dropdown) => {
                Object.values(InputType).forEach((type) => {
                    dropdown.addOption(type, type);
                });

                if (this.value.value != '') {
                    dropdown.setValue(this.value.type)
                }
                else {
                    dropdown.setValue(this.plugin.settings.lastSlotType)
                    this.value.type = this.plugin.settings.lastSlotType;
                }

                dropdown.onChange((value) => {
                    this.value.type = value as InputType;
                    this.plugin.settings.lastSlotType = value as InputType;
                    this.plugin.saveSettings();
                    this.updateSettings();
                    this.render();
                })
            });

        // Value setting
        this.valueSetting = new Setting(contentEl);

        // Alias setting
        new Setting(contentEl)
            .setName("Alias")
            .addText((text) => {
                this.aliasSetting = text;
                text
                    .setValue(this.value.alias || '')
                    .onChange((value) => {
                        this.value.alias = value;
                        this.render();
                    })
            });

        // Color settings
        new Setting(contentEl)
            .setName("Color")
            .addColorPicker(picker => {
                picker.setValue(this.value.color);
                this.colorPicker = picker;
                picker.setDisabled(!this.value.useCustomColor);
                picker.onChange((value) => {
                    this.value.color = value;
                    this.render();
                })
            })
            .addToggle(toggle =>
                toggle
                    .setValue(this.value.useCustomColor)
                    .onChange(val => {
                        this.value.useCustomColor = val;
                        const tempColor = this.value.color;
                        this.colorPicker.setValue(val ? this.value.color : this.value.defaultColor)
                        this.value.color = tempColor;
                        this.colorPicker.setDisabled(!val)
                        this.render();
                    })
            );

        this.render();
        flexContainerEl.appendChild(this.renderEl);
        flexContainerEl.appendChild(flexSettingsEl);
        contentEl.appendChild(flexContainerEl);

        // Transform settings
        new Setting(flexSettingsEl)
            .setName("Transform")
            .addToggle(toggle =>
                toggle
                    .setValue(this.value.customTransform)
                    .onChange(val => {
                        this.value.customTransform = val;
                        this.render();
                    })
            );
        new Setting(flexSettingsEl)
            .setName("X")
            .addSlider(slider => slider
                .setLimits(-200, 200, 0.01)
                .setValue(this.value.x)
                .sliderEl.addEventListener('input', (event) => {
                    const value = (event.target as HTMLInputElement).value;
                    this.value.x = parseFloat(value);
                    this.render();
                })
            );
        new Setting(flexSettingsEl)
            .setName("Y")
            .addSlider(slider => slider
                .setLimits(-200, 200, 0.01)
                .setValue(this.value.y)
                .sliderEl.addEventListener('input', (event) => {
                    const value = (event.target as HTMLInputElement).value;
                    this.value.y = parseFloat(value);
                    this.render();
                })
            );
        new Setting(flexSettingsEl)
            .setName("Rotation")
            .addSlider(slider => slider
                .setLimits(-180, 180, 0.01)
                .setValue(this.value.rotation)
                .sliderEl.addEventListener('input', (event) => {
                    const value = (event.target as HTMLInputElement).value;
                    this.value.rotation = parseFloat(value);
                    this.render();
                })
            );
        new Setting(flexSettingsEl)
            .setName("Scale")
            .addSlider(slider => slider
                .setLimits(0.5, 5, 0.01)
                .setValue(this.value.scale)
                .sliderEl.addEventListener('input', (event) => {
                    const value = (event.target as HTMLInputElement).value;
                    this.value.scale = parseFloat(value);
                    this.render();
                })
            );

        // Submit buttons
        new Setting(contentEl)
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