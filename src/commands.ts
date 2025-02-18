import { Command, Editor, MarkdownView } from 'obsidian';
import { TierListSettings } from 'settings';

export const insertTierListCommand = (settings: TierListSettings) => {
    return {
        id: 'tier-list-insert',
        name: 'Insert tier list',
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
        if (settings.useColors)
            text += `- <span style="background-color: ${tier.color};">${tier.name}</span>\n`;
        else
            text += `- ${tier.name}\n`;
    })
    text += `- ${settings.unordered} \n`;
    text += `\t- \n`;
    text += `- ${settings.settings} ${settings.tag}\n`;
    return text;
}