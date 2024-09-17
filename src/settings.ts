import { App, PluginSettingTab, Setting, TextComponent } from 'obsidian';
import TierListPlugin from 'main';
import Sortable from 'sortablejs';

interface TierItem {
	name: string;
	color: string;
}

export interface TierListSettings {
	tiers: TierItem[];
	order: boolean;
	property: string;
	unordered: string;
	tag: string;
	containerWidth: number;
	slotCount: number;
	settings: string;
}

export const DEFAULT_SETTINGS: TierListSettings = {
	tiers: [
		{ name: 'S Tier', color: '#FFD700' },
	],
	order: false,
	property: 'Image',
	unordered: 'To Rank',
	tag: '#tier-list',
	containerWidth: 70,
	slotCount: 10,
	settings: "Settings"
};

export class SettingTab extends PluginSettingTab {
	plugin: TierListPlugin;

	constructor(app: App, plugin: TierListPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Check if TextComponent value matches regex and do some cosmetic stuff
	checkNumber = async (text: TextComponent, regex: RegExp = /^(100|[1-9]?[0-9])$/): Promise<boolean> => {
		const value = text.getValue();
		// Delete useless heading zeros
		if (value[0] == '0' && value.length > 1)
			text.setValue(value.slice(1));

		if (regex.test(value)) {
			// save valid data to attribute
			text.inputEl.setAttribute('data-last-valid', value);
			return true;
		}
		// if value isn't empty and doesn't match then we should set last valid value
		else if (value != '')
			text.setValue(text.inputEl.getAttribute('data-last-valid') || '');
		return false;
	};

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// General Header/////////////////////////////////////////////////////////////////////////////////////
		containerEl.createEl('h1', { text: 'General' });

		// Order Dropdown
		new Setting(containerEl)
			.setName('Order')
			.addDropdown(dropdown => {
				dropdown
					.addOption('true', 'Right - First, Left - Last')
					.addOption('false', 'Left - First, Right - Last')
					.setValue(String(this.plugin.settings.order))
					.onChange(async (value) => {
						this.plugin.settings.order = value === 'true';
						this.display();
						await this.plugin.saveSettings();
					});
			});

		// Image Name Text
		new Setting(containerEl)
			.setName('Image Property Name')
			.setDesc('Obsidian property which is used as Image reference')
			.addText(text => {
				text
					.setValue(this.plugin.settings.property)
					.onChange(async value => {
						this.plugin.settings.property = value;
						await this.plugin.saveSettings();
					});
			});

		// Rank List Name Text
		new Setting(containerEl)
			.setName('To Rank List Name')
			.setDesc('The last and not renderable list')
			.addText(text => {
				text
					.setValue(this.plugin.settings.unordered)
					.onChange(async value => {
						this.plugin.settings.unordered = value;
						await this.plugin.saveSettings();
					});
			});
		
		// Tag Name Text
		new Setting(containerEl)
			.setName('Tag Name')
			.setDesc('Tag which marks list as Tier List')
			.addText(text => {
				text
					.setValue(this.plugin.settings.tag)
					.onChange(async value => {
						this.plugin.settings.tag = value;
						await this.plugin.saveSettings();
					});
			});

		// Settings Name Text
		new Setting(containerEl)
			.setName('Settings Name')
			.setDesc('') //TODO
			.addText(text => {
				text
					.setValue(this.plugin.settings.settings)
					.onChange(async value => {
						this.plugin.settings.settings = value;
						await this.plugin.saveSettings();
					});
			});

		// Tier List Container Width Text(Integer)
		new Setting(containerEl)
			.setName('Tier List Width')
			.setDesc('Width of Tier List container in percentage of screen')
			.addText(text => {
				text.inputEl.classList.add('tier-list-number-setting', 'tier-list-persentage-setting');
				text
					.setValue(this.plugin.settings.containerWidth.toString())
					.onChange(async value => {
						if (await this.checkNumber(text)) {
							this.plugin.settings.containerWidth = Number(text.getValue());
							this.plugin.saveSettings();
							this.plugin.resize();
						}
					});
			});

		// Number of Slots in tier Text(Integer)
		new Setting(containerEl)
			.setName('Number of Slots')
			.setDesc('How many slots will be displayed on one row before wrap to next line')
			.addText(text => {
				text.inputEl.classList.add('tier-list-number-setting', 'tier-list-pieces-setting');
				text.setValue(this.plugin.settings.slotCount.toString());
				text.onChange(async value => {
					if (await this.checkNumber(text)) {
						this.plugin.settings.slotCount = Number(text.getValue());
						this.plugin.saveSettings();
						this.plugin.resize();
					}
				});
			});

		// Default Tiers Header/////////////////////////////////////////////////////////////////////////////////////
		containerEl.createEl('h1', { text: 'Default Tiers' });

		const tierListEl = containerEl.createEl('div', { cls: 'tier-list' });

		this.plugin.settings.tiers.forEach((tier, index) => {
			const tierEl = tierListEl.createEl('div', { cls: 'tier-item', attr: { 'data-index': index.toString() } });

			const tierLabel = tierEl.createEl('div', { text: `Tier №${index + 1}`, cls: 'setting-item-name' });
			// Setting For Each Default Tier Lists
			const setting = new Setting(tierEl)
				// .setName(`Tier №${index + 1}`)
				.addText(text => text
					.setPlaceholder('Name')
					.setValue(tier.name)
					.onChange(async (value) => {
						tier.name = value;
						await this.plugin.saveSettings();
					})
				);
			
			// Tier Color Picker
			setting.addColorPicker(picker => {
				picker.setValue(tier.color);
				picker.onChange((value) => {
					tier.color = value;
					this.display();
					this.plugin.saveSettings();
				});
			});

			// Delete Tier Button
			setting.addButton(button => button
				.setIcon("trash")
				.setTooltip("Delete Tier")
				.onClick(async () => {
					this.plugin.settings.tiers.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				})
			);
		});

		// Add new Tier Button
		new Setting(containerEl)
			.addButton(btn => btn
				.setButtonText('Add Tier')
				.onClick(async () => {
					this.plugin.settings.tiers.push({ name: '', color: '#ffffff' });
					await this.plugin.saveSettings();
					this.display();
				})
			);

		// Initialize Sortable
		Sortable.create(tierListEl, {
			// handle: '.drag-handle',
			animation: 150,
			onEnd: async (evt) => {
				const oldIndex = evt.oldIndex!;
				const newIndex = evt.newIndex!;
				if (oldIndex !== newIndex) {
					const movedItem = this.plugin.settings.tiers.splice(oldIndex, 1)[0];
					this.plugin.settings.tiers.splice(newIndex, 0, movedItem);
					await this.plugin.saveSettings();
					this.display();
				}
			}
		});
	}
}

