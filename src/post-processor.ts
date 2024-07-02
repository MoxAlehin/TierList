import { 
    App, 
    MarkdownPostProcessorContext,
    MarkdownRenderer
} from 'obsidian';
import Sortable from 'sortablejs';
import { TierListSettings } from 'settings';

export function generateTierListMarkdownPostProcessor(app: App, settings: TierListSettings): (el: HTMLElement, ctx: MarkdownPostProcessorContext) => void {
    async function renderSlot(parent: HTMLElement, el: HTMLElement): Promise<HTMLElement> {
        const slot = parent.createEl('div', { cls: 'tier-list-slot' });
    
        // Check if we have embedded image
        const img = el.find('img');
        if (img) {
            slot.appendChild(img.cloneNode(true));
            addClickHandler(slot, el);
            addCursorChangeHandler(slot); // Add this line
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
                        if (imageSrc.match('http'))
                            imageSrc = `[](${imageSrc})`
                        await MarkdownRenderer.renderMarkdown(`!${imageSrc}`, slot, '', this.plugin);
                    }
                    addClickHandler(slot, el);
                    addCursorChangeHandler(slot); // Add this line
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
                addClickHandler(slot, el);
                addCursorChangeHandler(slot); // Add this line
            }
        }
        // Default is transferring elements from li
        else {
            el.findAll('div.list-collapse-indicator').forEach(el => el.remove());
            const textContainer = slot.createEl('div', { cls: 'text-content' });
            textContainer.innerHTML = el.innerHTML;
            addClickHandler(slot, el);
            addCursorChangeHandler(slot); // Add this line
        }
        return slot;
    }

    function addCursorChangeHandler(slot: HTMLElement) {
        slot.addEventListener('mouseover', (event: MouseEvent) => {
            if (event.ctrlKey) {
                slot.style.cursor = 'help';
            }
        });
    
        slot.addEventListener('mouseout', (event: MouseEvent) => {
            slot.style.cursor = 'default';
        });
    
        slot.addEventListener('mousemove', (event: MouseEvent) => {
            if (event.ctrlKey) {
                slot.style.cursor = 'help';
            } else {
                slot.style.cursor = 'default';
            }
        });
    }

    function addClickHandler(slot: HTMLElement, el: HTMLElement) {
        slot.addEventListener('click', (event: MouseEvent) => {
            if (event.ctrlKey) {
                const link = el.find('a.internal-link, a.external-link');
                if (link) {
                    const href = link.getAttribute('href');
                    if (href) {
                        if (link.hasClass('internal-link')) {
                            const file = app.metadataCache.getFirstLinkpathDest(href, '');
                            if (file) {
                                app.workspace.openLinkText(href, file.path);
                            }
                        } else {
                            window.open(href, '_blank');
                        }
                    }
                } else {
                    const img = slot.find('img');
                    if (img) {
                        const src = img.getAttribute('src');
                        if (src) {
                            window.open(src, '_blank');
                        }
                    }
                }
            }
        });
    }

    function initializeSortableSlots(tierListContainer: HTMLElement) {
        // Initialize Sortable for all tier-list-list elements
        tierListContainer.querySelectorAll('.tier-list-list').forEach(list => {
            Sortable.create(list as HTMLElement, {
                group: 'tier-list-slots',
                animation: 150,
                onEnd: (evt) => {
                    // Update the underlying Markdown structure here if needed
                }
            });
        });
    }

    function initializeSortableRows(tierListContainer: HTMLElement) {
        Sortable.create(tierListContainer, {
            handle: '.tier-list-tier',
            group: 'tier-list-rows',
            animation: 150,
            onEnd: (evt) => {
                // Update the underlying Markdown structure here if needed
            }
        });
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

            const tierListContainer = tierListWrapper.createEl('div', { cls: 'tier-list-container' });

            // For Each Nested List
            outerOl.findAll('li:has(ol)').forEach(outerLi => {
                // Create Row
                const row = tierListContainer.createEl('div', { cls: 'tier-list-row' });

                // Create Tier Box (if needed)
                let tier;
                let list: HTMLElement;
                if (!outerLi.textContent?.startsWith(settings.unordered)) {
                    tier = row.createEl('div', { cls: 'tier-list-tier' });
                    list = row.createEl('div', { cls: 'tier-list-list' });
                } else {
                    list = row.createEl('div', { cls: ['tier-list-list', 'tier-list-list-last'] });
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

            initializeSortableSlots(tierListContainer);
            initializeSortableRows(tierListContainer);
            outerOl.replaceWith(tierListWrapper);
        });
    }
}
