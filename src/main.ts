import { Plugin } from 'obsidian';
import { SettingTab, TierListSettings, DEFAULT_SETTINGS } from "settings"
import { generateTierListMarkdownPostProcessor, redraw } from 'post-processor'
import { insertTierListCommand } from 'commands'

export default class TierListPlugin extends Plugin {
	settings: TierListSettings;
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SettingTab(this.app, this));
		this.registerMarkdownPostProcessor(generateTierListMarkdownPostProcessor(this.app, this.settings, this));
		this.addCommand(insertTierListCommand(this.settings));
		this.resize();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.resize();
	}

	resize() {
		redraw(document.documentElement, this.settings);
	}
}