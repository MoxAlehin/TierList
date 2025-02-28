import { 
    MarkdownRenderer,
    Plugin
} from 'obsidian';

import { TierListSettings } from 'settings';

export async function renderSlot(plugin: Plugin, settings: TierListSettings, slot: HTMLElement): Promise<HTMLElement> {
    const app = plugin.app;
    slot.addClass("tier-list-slot");
    // Check for internal-embed span and replace with img
    const link = slot.find('a.internal-link');
    if (link && !link.getAttribute('href')?.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
        const filePath = link.getAttribute('href');
        if (filePath) {
            const file = app.metadataCache.getFirstLinkpathDest(filePath, '');
            if (file) {
                const fileCache = app.metadataCache.getFileCache(file);
                if (fileCache && fileCache.frontmatter && fileCache.frontmatter[settings.property]) {
                    let imageSrc = fileCache.frontmatter[settings.property];
                    if (imageSrc.match('http'))
                        imageSrc = `[](${imageSrc})`
                    slot.textContent = "";
                    await MarkdownRenderer.render(app, `!${imageSrc}`, slot, '', plugin);
                    slot.setAttr('href', filePath);
                }
            }
        }
    }

    // Wait for the Exacalidraw render
    setTimeout(() => {
        slot.findAll(".excalidraw-embedded-img").forEach(excalidrawEl => {
            const newElement = excalidrawEl.cloneNode(true);
            excalidrawEl.parentElement?.replaceChild(newElement, excalidrawEl);
        })
      }, 50);
    
    return slot;
}

