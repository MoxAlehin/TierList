import { Plugin } from 'obsidian';
import { SettingTab, TierListSettings, DEFAULT_SETTINGS } from "settings"
import { generateTierListMarkdownPostProcessor } from 'post-processor'
import { insertTierListCommand } from 'commands'

export default class TierListPlugin extends Plugin {
	settings: TierListSettings;
	async onload() {
		console.clear();
		await this.loadSettings();
		this.addSettingTab(new SettingTab(this.app, this));
		this.registerMarkdownPostProcessor(generateTierListMarkdownPostProcessor(this.app, this.settings));
		this.addCommand(insertTierListCommand(this.settings));
		this.resize()
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	resize() {
		// document.documentElement.style.setProperty('--tier-list-slot-width', `${screen.width / this.settings.slotCount * this.settings.containerWidth / 100}px`)
		document.documentElement.style.setProperty('--tier-list-width-ratio', `${this.settings.containerWidth / 100}`)
		document.documentElement.style.setProperty('--screen-width', `${screen.width}px`)
		document.documentElement.style.setProperty('--tier-list-slot-count', `${this.settings.slotCount}`)
	}
}