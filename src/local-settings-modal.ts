import { App, Modal, Setting } from "obsidian";
import { TierListSettings, DEFAULT_SETTINGS } from 'settings';

type EditableSettings = "width" | "slots" | "ratio" | "from" | "where";

const AVAILABLE_SETTINGS: EditableSettings[] = ["width", "slots", "ratio", "from", "where"];

export class LocalSettingsModal extends Modal {
	private settings: TierListSettings;
	private onSave: (updatedSettings: Partial<TierListSettings>) => void;

	constructor(app: App, settings: TierListSettings, onSave: (updatedSettings: Partial<TierListSettings>) => void) {
		super(app);
		this.settings = settings;
		this.onSave = onSave;
	}

    init(settings: TierListSettings) {
        const { contentEl } = this;
		contentEl.empty();

		this.setTitle("Local Settings");

		const updatedSettings: Partial<TierListSettings> = {};

		AVAILABLE_SETTINGS.forEach((key) => {
            updatedSettings[key] = settings[key] as any;
            new Setting(contentEl)
                .setName(key.charAt(0).toUpperCase() + key.slice(1))
                .addText((text) => {
                    const initialValue = settings[key] as string | number;
        
                    text.setValue(String(initialValue)).onChange((value) => {
                        const defaultValue = DEFAULT_SETTINGS[key];
        
                        if (typeof defaultValue === "number") {
                            (updatedSettings as Record<string, number | string>)[key] = Number(value) || 0;
                        } else {
                            (updatedSettings as Record<string, number | string>)[key] = value;
                        }
                    });
                });
        });

		new Setting(contentEl)
            .addButton((btn) => btn.setIcon("undo-2").setCta().onClick(() => {
                this.init(DEFAULT_SETTINGS);
            }))
			.addButton((btn) =>
				btn.setIcon("check").setCta().onClick(() => {
					this.onSave(updatedSettings);
					this.close();
				})
			);
    }

	onOpen() {
		this.init(this.settings);
	}
}