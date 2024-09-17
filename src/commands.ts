import { Command, Editor, MarkdownView } from 'obsidian';
import { TierListSettings } from 'settings';

export const insertTierListCommand = (settings: TierListSettings) => {
    return {
        id: 'tier-list-insert',
        name: 'Insert Tier List',
        editorCallback: (editor: Editor, view: MarkdownView) => {
            const cursor = editor.getCursor();
            const text = constructTierList(settings);
            editor.replaceRange(text, cursor);
            const endPos = {
                line: cursor.line,
                ch: cursor.ch + text.length
            };
            editor.setCursor(endPos);
        },
    }
};

const constructTierList = (settings: TierListSettings) => {
    let text = '';
    settings.tiers.forEach(tier => {
        text += `1. ${tier.name}\n`;
    })
    text += `1. ${settings.unordered} \n`;
    text += `\t1. \n`;
    text += `1. ${settings.settings} ${settings.tag}\n`;
    text += `\t1. \n`;
    return text;
}