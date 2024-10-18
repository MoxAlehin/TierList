import { 
    App, 
    MarkdownPostProcessorContext,
    MarkdownRenderer
} from 'obsidian';
import Sortable from 'sortablejs';
import { TierListSettings } from 'settings';

export function redraw(el: HTMLElement, settings: TierListSettings) {
    el.style.setProperty('--tier-list-width-ratio', `${settings.width / 100}`);
    el.style.setProperty('--screen-width', `${screen.width}px`);
    el.style.setProperty('--tier-list-slot-count', `${settings.slots}`);
    el.style.setProperty('--tier-list-aspect-ratio', `${settings.ratio}`);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    hex = hex.replace(/^#/, '');

    let bigint;
    if (hex.length === 3) {
        bigint = parseInt(hex.split('').map(char => char + char).join(''), 16);
    } else if (hex.length === 6) {
        bigint = parseInt(hex, 16);
    } else {
        return null;
    }

    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

function isLightColor(hex: string): boolean {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;

    const brightness = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
    return brightness > 150;
}

export function generateTierListMarkdownPostProcessor(app: App, settings: TierListSettings): (el: HTMLElement, ctx: MarkdownPostProcessorContext) => void {
    async function renderSlot(parent: HTMLElement, el: HTMLElement): Promise<HTMLElement> {
        const slot = parent.createEl('div', { cls: 'tier-list-slot' });

        // Check for internal-embed span and replace with img
        let isDefault: boolean = true;
        if (el.find('a.internal-link') && !el.find('a.internal-link').getAttribute('href')?.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
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
                        await MarkdownRenderer.render(app, `!${imageSrc}`, slot, '', this.plugin);
                        isDefault = false;
                    }
                }
            }
        }

        if (isDefault) {
            // slot.appendChild(el.cloneNode(true));
            await MarkdownRenderer.render(app, el.outerHTML, slot, '', this.plugin);
        }
    
        addClickHandler(slot, el);
        addCursorChangeHandler(slot);
        return slot;
    }

    function addCursorChangeHandler(slot: HTMLElement) {
        slot.addEventListener('mouseover', (event: MouseEvent) => {
            if (event.ctrlKey) {
                slot.classList.add('help-cursor');
            }
        });
    
        slot.addEventListener('mouseout', (event: MouseEvent) => {
            slot.classList.remove('help-cursor');
        });
    
        slot.addEventListener('mousemove', (event: MouseEvent) => {
            if (event.ctrlKey) {
                slot.classList.add('help-cursor');
            } else {
                slot.classList.remove('help-cursor');
            }
        });
    }

    function addClickHandler(slot: HTMLElement, el: HTMLElement) {
        if (el.find('.excalidraw-embedded-img'))
            return;
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
            onMove: (evt) => {
                return evt.related.querySelector('.tier-list-list-last') === null;
            },
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
            outerOl.findAll(':scope > li').forEach(outerLi => {
                //Settings override
                if (outerLi.textContent?.startsWith(settings.settings)) {

                    const pairs: { [key: string]: string } = {};

                    outerLi.findAll('li').forEach(setting => {
                        const text = setting.textContent || '';
                        const [key, value] = text.split(':').map(item => item.trim());
                        if (key && value) {
                            pairs[key] = value;
                        }
                    });

                    const localSettings: TierListSettings = { ...settings }; 

                    for (const [key, value] of Object.entries(pairs)) {
                        switch (key.toLowerCase()) {
                            case 'order':
                                localSettings.order = value.toLowerCase() === 'true';
                                break;
                            case 'property':
                                localSettings.property = value;
                                break;
                            case 'unordered':
                                localSettings.unordered = value;
                                break;
                            case 'tag':
                                localSettings.tag = value;
                                break;
                            case 'width':
                                localSettings.width = parseInt(value);
                                break;
                            case 'slots':
                                localSettings.slots = parseInt(value);
                                break;
                            case 'settings':
                                localSettings.settings = value;
                                break;
                            case 'ratio':
                                localSettings.ratio = parseFloat(value);
                                break;
                            default:
                                console.warn(`Unknown setting key: ${key}`);
                                break;
                        }
                    }

                    redraw(tierListContainer, localSettings)
                    
                    return;
                }

                // Create Row
                const row = tierListContainer.createEl('div', { cls: 'tier-list-row' });

                // Create Tier Box (if needed)
                let tier;
                let list: HTMLElement;
                if (!outerLi.textContent?.startsWith(settings.unordered)) {

                    tier = row.createEl('div', { cls: 'tier-list-tier' });
                    list = row.createEl('div', { cls: 'tier-list-list' });

                    // const matchedTier = settings.tiers.find(tier => outerLi.textContent?.startsWith(`${tier.name}`));
                    const matchedTier = settings.tiers.find(tier => new RegExp(`^${tier.name}(\\n|$)`, 'm').test(outerLi.textContent || ''));
                    console.log(outerLi.textContent)
                    if (matchedTier) {
                        const textColor = isLightColor(matchedTier.color) ? '#000000' : '#FFFFFF';
                        tier.style.setProperty('background-color', `${matchedTier.color}`);
                        tier.style.setProperty('color', `${textColor}`);
                    }

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
