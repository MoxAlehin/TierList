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
        text += `- ${tier.name}\n`;
    })
    text += `- ${settings.unordered}\n`;
    text += `\t- `;
    return text;
}