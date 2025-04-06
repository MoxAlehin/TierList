import { MarkdownRenderer, Plugin } from 'obsidian';
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
                const parent = link.parentElement;
                if (fileCache && fileCache.frontmatter && fileCache.frontmatter[settings.image] && parent) {
                    let imageSrc = fileCache.frontmatter[settings.image];
                    if (imageSrc.match('http'))
                        imageSrc = `[](${imageSrc})`
                    parent.textContent = '';
                    await MarkdownRenderer.render(app, `!${imageSrc}`, parent, '', plugin);
                    slot.setAttr('href', filePath);
                    if (settings.title) {
                        addTitle(slot, link.textContent || '');
                    }
                    else {
                        slot.setAttr('title', link.textContent);
                    }
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

    const child = slot.find('[style*="background"]')
    if (child) {
        slot.style.backgroundColor = child.style.backgroundColor;
    }

    const fileEmbed = slot.find('.internal-embed.file-embed.mod-generic.is-loaded')
    if (fileEmbed) {
        const textNode = findTextNodeRecursive(fileEmbed);
        if (textNode) {
            textNode.nodeValue = fileEmbed.getAttr('alt');
        }
    }

    const altEl = slot.find('[alt]')
    if (altEl && !fileEmbed) {
        if (settings.title) {
            addTitle(slot, altEl.getAttr('alt') || '');
        }
        else {
            slot.setAttr('title', altEl.getAttr('alt'));
        }
    }

    const embedTitle = slot.find('.markdown-embed-title');
    if (embedTitle) {
        embedTitle.remove();
    }

    return slot;
}

function addTitle(parentElement: HTMLElement, text: string) {
    if (parentElement.find('.tier-list-title')) return;

    const textOverlay = parentElement.createEl('div', {
        cls: 'tier-list-title',
    });

    const backgroundElement = textOverlay.createEl('div', {
        cls: 'tier-list-title-background',
    });

    const textElement = textOverlay.createEl('span', {
        text: text,
        cls: 'tier-list-title-text',
    });
}

function findTextNodeRecursive(element: HTMLElement): Text | null {
    const childNodesArray: ChildNode[] = Array.from(element.childNodes);

    for (const node of childNodesArray) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node as Text;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const found = findTextNodeRecursive(node as HTMLElement);
            if (found) return found;
        }
    }
    return null;
}

