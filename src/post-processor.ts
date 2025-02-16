import { 
    App, 
    MarkdownPostProcessorContext,
    MarkdownRenderer,
    Component,
    TFile
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

async function moveLinesInActiveFile(startIndex: number, count: number, newIndex: number, correction: boolean = true) {
    const file = app.workspace.getActiveFile();
    if (!file || startIndex == newIndex) {
        return;
    }

    let content = await app.vault.read(file);
    let lines = content.split("\n");

    if (startIndex < 0 || startIndex >= lines.length || count <= 0 || startIndex + count > lines.length || newIndex < 0 || newIndex > lines.length) {
        return;
    }

    const removedLines = lines.splice(startIndex, count);

    if (newIndex > startIndex && correction) {
        newIndex -= count;
    }

    lines.splice(newIndex, 0, ...removedLines);

    await app.vault.modify(file, lines.join("\n"));
}

export function generateTierListMarkdownPostProcessor(app: App, settings: TierListSettings, component: Component): (el: HTMLElement, ctx: MarkdownPostProcessorContext) => void {
    async function renderSlot(el: HTMLElement): Promise<HTMLElement> {
        const parent = el.parentElement || document.documentElement;

        // Check for internal-embed span and replace with img
        if (el.find('a.internal-link') && !el.find('a.internal-link').getAttribute('href')?.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
            const link = el.find('a.internal-link');
            const filePath = link.getAttribute('href');
            if (filePath) {
                const file = app.metadataCache.getFirstLinkpathDest(filePath, '');
                if (file) {
                    const fileCache = app.metadataCache.getFileCache(file);
                    if (fileCache && fileCache.frontmatter && fileCache.frontmatter[settings.property]) {
                        let imageSrc = fileCache.frontmatter[settings.property];
                        if (imageSrc.match('http'))
                            imageSrc = `[](${imageSrc})`
                        el.innerHTML = "";
                        await MarkdownRenderer.render(app, `!${imageSrc}`, el, '', component);
                    }
                }
            }
        }
    
        addClickHandler(el, el);
        addCursorChangeHandler(el);
        return el;
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
        tierListContainer.querySelectorAll('ul > li > ul').forEach(list => {
            Sortable.create(list as HTMLElement, {
                group: 'slot',
                animation: 150,
                onEnd: (evt) => {
                    const tierListLine = parseInt(evt.item.parentElement?.parentElement?.parentElement?.parentElement?.getAttr("data-line") || "0");
                    const parentLine = parseInt(evt.item.parentElement?.parentElement?.getAttr("data-line") || "0", 10);
                    const newIndex = evt.newIndex || 0;
                    const oldParentIndex = parseInt(evt.from.parentElement?.getAttr("data-line") || "0");
                    const oldIndex = evt.oldIndex || 0;

                    let newLine = tierListLine + parentLine + newIndex + 1;
                    let oldLine = tierListLine + oldParentIndex + oldIndex + 1;
                    if (oldLine < newLine && oldParentIndex == parentLine)
                        newLine = newLine + 1;

                    moveLinesInActiveFile(oldLine, 1, newLine);
                }
            });
        });
    }

    function initializeSortableRows(tierListContainer: HTMLElement) {
        Sortable.create(tierListContainer.find(":scope > ul"), {
            handle: 'ul > li > div',
            group: 'tier',
            animation: 150,
            onEnd: (evt) => {
                if (evt.oldIndex == evt.newIndex)
                    return;

                const tier = evt.item;
                const tierLine = parseInt(tier.parentElement?.parentElement?.getAttr("data-line") || "0");
                const oldLine = parseInt(tier.getAttr("data-line") || "0") + tierLine;
                let newIndex = evt.newIndex || 0;
                let oldIndex = evt.oldIndex || 0;
                const ul = tier.parentElement;
                const length = tier.find("ul").children.length + 1;

                const oldChild = ul?.children[newIndex + (newIndex > oldIndex ? -1 : 1)];
                
                const oldChildLength = (oldChild?.find("ul")?.children.length || 0) + 1;
                const oldChildLine = parseInt(oldChild?.getAttr("data-line") || "0");

                let newLine = oldChildLine + tierLine;

                if (newIndex >=  oldIndex) {
                    newLine = newLine + oldChildLength - length;
                }

                moveLinesInActiveFile(oldLine, length, newLine, false);
            }
        });
    }

    return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {

        const tagEl: HTMLElement = el.find(`a[href="${settings.tag}"]`);
        if (!tagEl) 
            return;
        tagEl.remove();

        if (ctx.getSectionInfo(el)) {
            el.setAttr("data-line", ctx.getSectionInfo(el)?.lineStart || 0);
        }
        
        el.addClass("tier-list");   

        el.findAll(".list-bullet").forEach(span => span.remove());
        el.findAll(".list-collapse-indicator").forEach(span => span.remove());

        el.findAll(":scope > ul > li:not(:has(ul))").forEach(list => {
            const newul = document.createElement("ul");
            list.appendChild(newul);
        })

        el.findAll(":scope > ul > li").forEach(li => {

            let text: string = "";
            let unordered: boolean = false;
            li.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.nodeValue?.contains(settings.settings)) {
                        li.remove();
                        
                        const pairs: { [key: string]: string } = {};

                        li.findAll('li').forEach(setting => {
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
                            redraw(el, localSettings)
                            
                            return;
                    }

                    else if (node.nodeValue?.contains(settings.unordered)) {
                        unordered = true;
                    }
                    else {
                        text = text + node.nodeValue;
                    }
                    node.remove();
                }
            })
            if (!unordered) {
                const innerList = li.find("ul");

                const tierDiv = document.createElement("div");
                tierDiv.textContent = text;

                Array.from(li.childNodes).forEach(node => {
                    if (node != innerList) {
                        tierDiv.appendChild(node);
                    }
                })

                li.prepend(tierDiv);
                renderSlot(tierDiv);
            }
            else {
                li.find("ul").addClass("unordered");
            }
        })

        el.findAll(":scope > ul > li > ul > li").forEach( li => {
            renderSlot(li);
        })

        initializeSortableSlots(el);
        initializeSortableRows(el);
    }
}
