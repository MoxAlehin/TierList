import TierListPlugin from 'main';
import { Modal, Setting, ColorComponent, TextComponent, ButtonComponent, MarkdownRenderer, Component } from 'obsidian';
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

    isUseTab: boolean;
    x: number = 0;
    y: number = 0;
    rotation: number = 0;
    scale: number = 1;
    mirrorX: boolean = false;
    mirrorY: boolean = false;

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
                if (key === "background" || key === 'background-color') {
                    this.color = value;
                } else if (key === "transform") {
                    this.parseTransform(value);
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
    }

    public isDefaultTransform():boolean {
        return !this.mirrorX && !this.mirrorY && Number(this.rotation.toFixed(2)) == 0 && Number(this.scale.toFixed(2)) == 1 && this.x == 0 && this.y == 0;
    }

    private parseTransform(transformString: string) {
        const translateMatch = transformString.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        const rotateMatch = transformString.match(/rotate\(([-\d.]+)deg\)/);
        const scaleMatch = transformString.match(/scale\(([-\d.]+),? ?([-\d.]+)?\)/);
        if (translateMatch) {
            this.x = parseFloat(translateMatch[1]);
            this.y = parseFloat(translateMatch[2]);
        }
        if (rotateMatch) {
            this.rotation = parseFloat(rotateMatch[1]);
        }
        if (scaleMatch) {
            const scale = parseFloat(scaleMatch[1]);
            this.scale = Math.abs(scale);
            if (scaleMatch[2]) {
                this.mirrorX = parseFloat(scaleMatch[1]) < 0;
                this.mirrorY = parseFloat(scaleMatch[2]) < 0;
            }
            else if (scale < 0) {
                this.mirrorX = true;
                this.mirrorY = true;
            }
        }
    }

    private getTransformStyle(): string {
        if (this.isDefaultTransform())
            return '';
        const transforms = [];
        const x = Math.round(this.x);
        const y = Math.round(this.y);
        const rotation = Number(this.rotation.toFixed(2));
        const scale = Number(this.scale.toFixed(2));

        if (x !== 0 || y !== 0) {
            transforms.push(`translate(${x}px, ${y}px)`);
        }
        if (rotation !== 0) {
            transforms.push(`rotate(${rotation}deg)`);
        }
        if (scale !== 1 || this.mirrorX || this.mirrorY) {
            if (this.mirrorX && this.mirrorY)
                transforms.push(`scale(${-scale})`);
            else if (!this.mirrorX && !this.mirrorY)
                transforms.push(`scale(${scale})`);
            else if (this.mirrorX)
                transforms.push(`scale(${-scale}, ${scale})`);
            else
                transforms.push(`scale(${scale}, ${-scale})`);
        }

        return `transform: ${transforms.join(" ")};`.trim();
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

        if (this.color != this.defaultColor) {
            styles.push(`background:${this.color};`);
        }
        styles.push(this.getTransformStyle());
        const style = styles.join(" ").trim();

        if (style) {
            output = `<span style="${style}">${output}</span>`;
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
    private colorResetButton: ButtonComponent;
    private transformResetButton: ButtonComponent;
    private mirrorXButton: ButtonComponent;
    private mirrorYButton: ButtonComponent;
    private component: Component;

    async render() {
        if (this.value.isDefaultTransform())
            this.transformResetButton.removeCta()
        else
            this.transformResetButton.setCta();
        const app = this.plugin.app;
        const str = this.value.toString().replace(/^\t/, '');
        this.renderEl.replaceChildren();
        await MarkdownRenderer.render(app, str, this.renderEl, '', this.component); 
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
        this.component = new Component();

        redraw(this.renderEl, this.settings);

        this.value = new ParsedInput(value);

        this.setTitle(header);

        let isDragging = false;
        let isRotating = false;
        let mouseStartX = 0, mouseStartY = 0, startX = 0, startY = 0;
        let startAngle = 0;

        function isNearCorner(mouseX: number, mouseY: number, el: HTMLElement): boolean {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            const ROTATION_THRESHOLD = 20;
            const corners = [
                { x: rect.left, y: rect.top },
                { x: rect.right, y: rect.top },
                { x: rect.left, y: rect.bottom },
                { x: rect.right, y: rect.bottom },
            ];

            for (const corner of corners) {
                const distance = Math.sqrt((mouseX - corner.x) ** 2 + (mouseY - corner.y) ** 2);
                if (distance < ROTATION_THRESHOLD) return true;
            }

            return false;
        }

        this.renderEl.addEventListener("mousedown", (event: MouseEvent) => {
            event.preventDefault();
            const rect = this.renderEl.find('.tier-list-slot').getBoundingClientRect();
            const mouseX = event.clientX;
            const mouseY = event.clientY;

            if (isNearCorner(mouseX, mouseY, this.renderEl.find('.tier-list-slot'))) {
                isRotating = true;
                startAngle = Math.atan2(mouseY - rect.top - rect.height / 2, mouseX - rect.left - rect.width / 2) / Math.PI * 180;
                return;
            }

            isDragging = true;
            mouseStartX = mouseX;
            mouseStartY = mouseY;
            startX = this.value.x;
            startY = this.value.y;
        });

        const mouseMoveCallback = (event: MouseEvent) => {
            // event.preventDefault();
            if (isNearCorner(event.clientX, event.clientY, this.renderEl.find('.tier-list-slot'))) {
                this.renderEl.addClass('rotate');
                this.renderEl.removeClass('move');
            }
            else {
                this.renderEl.addClass('move');
                this.renderEl.removeClass('rotate');
            }

            if (isDragging) {
                this.value.x = startX + event.clientX - mouseStartX;
                this.value.y = startY + event.clientY - mouseStartY;
                this.render();
            }

            if (isRotating) {
                const rect = this.renderEl.getBoundingClientRect();
                const angle = Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2) / Math.PI * 180;
                this.value.rotation += angle - startAngle;
                startAngle = angle;
                this.render();
            }
        }

        document.addEventListener("mousemove", mouseMoveCallback);

        document.addEventListener("mouseup", () => {
            isDragging = false;
            isRotating = false;
            this.renderEl.removeClass('move');
            this.renderEl.removeClass('rotate');
        });

        this.renderEl.addEventListener("wheel", (event: WheelEvent) => {
            event.preventDefault();
            this.value.scale += event.deltaY * -0.0005;
            this.value.scale = Math.max(this.value.scale, 0)
            this.render()
        }, { passive: false });

        const onSubmitHandler = () => {
            this.close();
            onSubmit(this.value.toString());
        };

        flexContainerEl.appendChild(this.renderEl);
        flexContainerEl.appendChild(flexSettingsEl);
        contentEl.appendChild(flexContainerEl);

        // Use Tab setting
        new Setting(flexSettingsEl)
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
        new Setting(flexSettingsEl)
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
        this.valueSetting = new Setting(flexSettingsEl);

        // Alias setting
        new Setting(flexSettingsEl)
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
        new Setting(flexSettingsEl)
            .setName("Color")
            .addColorPicker(picker => {
                this.colorPicker = picker;
                picker.setValue(this.value.color);
                picker.onChange((value) => {
                    this.value.color = value;
                    if (value != this.value.defaultColor) {
                        this.colorResetButton.setCta();
                    }
                    this.render();
                })
            })
            .addButton((btn) => {
                this.colorResetButton = btn;
                if (this.value.color != this.value.defaultColor) {
                    btn.setCta();
                }
                btn
                    .setIcon("undo-2")
                    .onClick(() => {
                        this.value.color = this.value.defaultColor;
                        this.colorPicker.setValue(this.value.color);
                        btn.removeCta();
                        this.render();
                    })
            });

        // Transform settings
        new Setting(flexSettingsEl)
            .setName("Transform")
            .addButton((btn) => {
                this.mirrorXButton = btn;
                btn
                    .setIcon("flip-horizontal")
                    .onClick(() => {
                        this.value.mirrorX = !this.value.mirrorX;
                        if (this.value.mirrorX)
                            btn.setCta();
                        else
                            btn.removeCta();
                        this.render();
                    })
                if (this.value.mirrorX) {
                    btn.setCta();
                }
            })
            .addButton((btn) => {
                this.mirrorYButton = btn;
                btn
                    .setIcon("flip-vertical")
                    .onClick(() => {
                        this.value.mirrorY = !this.value.mirrorY;
                        if (this.value.mirrorY)
                            btn.setCta();
                        else
                            btn.removeCta();
                        this.render();
                    })
                if (this.value.mirrorY) {
                    btn.setCta();
                }
            })
            .addButton((btn) => {
                this.transformResetButton = btn;
                btn
                    .setIcon("undo-2")
                    .onClick(() => {
                        this.value.x = 0;
                        this.value.y = 0;
                        this.value.rotation = 0;
                        this.value.scale = 1;
                        this.value.mirrorX = false;
                        this.value.mirrorY = false;
                        this.mirrorXButton.removeCta();
                        this.mirrorYButton.removeCta();
                        btn.removeCta();
                        this.render();
                    })
                    if (!this.value.isDefaultTransform()) {
                        btn.setCta();
                    }
            });

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

        this.render();
        this.updateSettings();
        this.onOpen = () => {
            setTimeout(() => {
                this.valueComponent.inputEl.focus();
                this.valueComponent.inputEl.select();
            }, 0);
        };
        this.onClose = () => {
            this.component.unload();
            document.removeEventListener('mousemove', mouseMoveCallback);
        }
    }
}