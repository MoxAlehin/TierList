import { 
    App, 
    MarkdownPostProcessorContext,
    MarkdownRenderer
} from 'obsidian';
import { getAPI, Link } from 'obsidian-dataview';
import { TierListSettings } from 'settings';

export function generateTierListMarkdownPostProcessor(app: App, settings: TierListSettings): (el: HTMLElement, ctx: MarkdownPostProcessorContext) => void {
    async function renderSlot(parent: HTMLElement, el: HTMLElement): Promise<HTMLElement> {
        const slot = parent.createEl('div', {cls: 'tier-list-slot'});

        // Check if we have embedded image
        const img = el.find('img');
        if (img) {
            slot.appendChild(img.cloneNode(true));
        }
        // Check if we have Internal Link
        else if (el.find('a.internal-link') && !el.find('a.internal-link').getAttribute('href')?.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
            const link = el.find('a.internal-link');
            const filePath = link.getAttribute('href');
            if (filePath) {
                const file = app.metadataCache.getFirstLinkpathDest(filePath, '');
                if (file) {
                    const fileCache = app.metadataCache.getFileCache(file);
                    if (fileCache && fileCache.frontmatter && fileCache.frontmatter['Image']) {
                        let imageSrc = fileCache.frontmatter['Image'];

                        // Check if Image field is an internal link
                        // const internalLinkMatch = imageSrc.match(/!?\[\[(.*?)\]\]/);
                        // if (internalLinkMatch) {
                        //     const internalImageFilePath = internalLinkMatch[1];
                        //     imageSrc = internalImageFilePath;
                        // }
                        
                        if (imageSrc.match('http'))
                            imageSrc = `[](${imageSrc})`
                        await MarkdownRenderer.renderMarkdown(`!${imageSrc}`, slot, '', this);
                    }
                }
            }
        }
        // Check for internal-embed span and replace with img
        else if (el.find('span.internal-embed')) {
            const embedSpan = el.find('span.internal-embed');
            const imageSrc = embedSpan.getAttribute('src');
            const internalImageFile = app.metadataCache.getFirstLinkpathDest(imageSrc || '', '');
            if (imageSrc && internalImageFile) {
                const img = slot.createEl('img');
                img.setAttribute('src', app.vault.getResourcePath(internalImageFile));
                slot.appendChild(img);
            }
        }
        // Default is transferring elements from li
        else {
            el.findAll('div.list-collapse-indicator').forEach(el => el.remove());
            const textContainer = slot.createEl('div', {cls: 'text-content'});
            textContainer.innerHTML = el.innerHTML;
        }
        return slot;
    }

    return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        // For Each Nesting List
        el.findAll(`ol:has(ol)`).forEach(outerOl => {
            // Find Predefined Tag
            if (!outerOl.parentElement?.hasClass(`tag-${settings.tag.slice(1)}`))
                return;
            // Clean Tag
            outerOl.findAll(`a[href="${settings.tag}"]`).forEach(el => el.remove());

            // Tier List Element
            const tierListWrapper = document.createElement('div');
            tierListWrapper.addClass('tier-list-container-wrapper');

            const tierListContainer = tierListWrapper.createEl('div', {cls: 'tier-list-container'});

            // For Each Nested List
            outerOl.findAll('li:has(ol)').forEach(outerLi => {
                // Create Row
                const row = tierListContainer.createEl('div', {cls: 'tier-list-row'});

                // Create Tier Box (if needed)
                let tier;
                let list: HTMLElement;
                if (!outerLi.textContent?.startsWith(settings.unordered)) {
                    tier = row.createEl('div', {cls: 'tier-list-tier'});
                    list = row.createEl('div', {cls: 'tier-list-list'});
                } else {
                    list = row.createEl('div', {cls: ['tier-list-list', 'tier-list-list-last']});
                }

                // Fill Ranking List
                outerLi.findAll('ol li').forEach(innerLi => {
                    renderSlot(list, innerLi);
                });
                outerLi.findAll('ol').forEach(el => el.remove());

                // Fill Tier Box
                if (tier) {
                    renderSlot(tier, outerLi);
                }
            });
            outerOl.replaceWith(tierListWrapper);
        });
    }
}
