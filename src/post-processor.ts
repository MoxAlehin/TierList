import { 
    App, 
    MarkdownPostProcessorContext,
    MarkdownRenderer,
    Component,
    Menu
} from 'obsidian';
import Sortable from 'sortablejs';
import { SlotModal } from 'modal';
import { TierListSettings } from 'settings';

export function redraw(el: HTMLElement, settings: TierListSettings) {
    el.style.setProperty('--tier-list-width-ratio', `${settings.width / 100}`);
    el.style.setProperty('--screen-width', `${screen.width}px`);
    el.style.setProperty('--tier-list-slot-count', `${settings.slots}`);
    el.style.setProperty('--tier-list-aspect-ratio', `${settings.ratio}`);
}

function findDataLine(el: HTMLElement): number {
    let closestLineElement: HTMLElement | null = null;
    let farthestLineElement: HTMLElement | null = null;
    let current: HTMLElement | null = el;

    while (current) {
        if (current.hasAttribute("data-line")) {
            if (!closestLineElement) {
                closestLineElement = current;
            }
            farthestLineElement = current;
        }
        current = current.parentElement;
    }

    if (closestLineElement && farthestLineElement) {
        const closestValue = parseInt(closestLineElement.getAttribute("data-line") || "0", 10);
        const farthestValue = parseInt(farthestLineElement.getAttribute("data-line") || "0", 10);
        return closestLineElement === farthestLineElement ? closestValue : closestValue + farthestValue;
    }

    return 0;
}

export function generateTierListMarkdownPostProcessor(app: App, settings: TierListSettings, component: Component): (el: HTMLElement, ctx: MarkdownPostProcessorContext) => void {
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
    
    async function replaceLineInActiveFile(lineNumber: number, newText: string) {
        const activeFile = app.workspace.getActiveFile();
        if (!activeFile) return;
    
        const fileContent = await app.vault.read(activeFile);
        const lines = fileContent.split("\n");
    
        if (lineNumber < 0 || lineNumber >= lines.length) {
            return;
        }
    
        lines[lineNumber] = newText;
    
        await app.vault.modify(activeFile, lines.join("\n"));
    }
    
    async function readLineFromActiveFile(lineNumber: number): Promise<string | null> {
        const activeFile = app.workspace.getActiveFile();
        if (!activeFile) return null;
    
        const fileContent = await app.vault.read(activeFile);
        const lines = fileContent.split("\n");
    
        if (lineNumber < 0 || lineNumber >= lines.length) {
            console.error("Номер строки выходит за границы файла");
            return null;
        }
    
        return lines[lineNumber];
    }
    
    async function deleteLineInActiveFile(lineNumber: number) {
        const activeFile = app.workspace.getActiveFile();
        if (!activeFile) return;
    
        const content = await app.vault.read(activeFile);
        const lines = content.split("\n");
    
        if (lineNumber < 0 || lineNumber >= lines.length) return; // Проверка границ
    
        lines.splice(lineNumber, 1); // Удаляем строку
    
        await app.vault.modify(activeFile, lines.join("\n")); // Записываем обратно
    }

    async function insertLineInActiveFile(lineNumber: number, newText: string) {
        const activeFile = app.workspace.getActiveFile();
        if (!activeFile) return;
    
        const fileContent = await app.vault.read(activeFile);
        const lines = fileContent.split("\n");
    
        // Ограничиваем lineNumber, чтобы он был в пределах допустимого диапазона
        const index = Math.max(0, Math.min(lineNumber, lines.length));
    
        // Вставляем строку в нужное место
        lines.splice(index, 0, newText);
    
        // Записываем обновлённый контент обратно в файл
        await app.vault.modify(activeFile, lines.join("\n"));
    }
    
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

        el.addEventListener("contextmenu", async (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            const menu = new Menu();
            const line = findDataLine(el);
            const str = await readLineFromActiveFile(line);
    
            menu.addItem((item) => item.setTitle("Add Slot").setIcon("square-plus").onClick(() => {
                new SlotModal(app, "Add Slot", "\t", (result) => {
                    if (result != "")
                        insertLineInActiveFile(line, result);
                }).open();
            }));
            menu.addItem((item) => item.setTitle("Edit Slot").setIcon("pencil").onClick(() => {
                new SlotModal(app, "Change Slot", str || "0", (result) => {
                    if (result != "")
                        replaceLineInActiveFile(line, result);
                    else
                        deleteLineInActiveFile(line);
                }).open();
            }));
            menu.addItem((item) => item.setTitle("Delete Slot").setIcon("trash-2").onClick(() => {
                deleteLineInActiveFile(line);
            }));

            menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
        })
    
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
            event.preventDefault();
            event.stopPropagation();
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
        slot.addEventListener("dblclick", async (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            let line;
            if (slot instanceof HTMLDivElement) {
                const parentLine = parseInt(slot.parentElement?.parentElement?.parentElement?.getAttribute("data-line") || "0");
                line = parseInt(slot.parentElement?.getAttr("data-line") || "0") + parentLine;
            }
            else {
                const parentLine = parseInt(slot.parentElement?.parentElement?.parentElement?.parentElement?.getAttribute("data-line") || "0");
                line = parseInt(slot.getAttr("data-line") || "0") + parentLine;
            }
            
            const str = await readLineFromActiveFile(line);
            new SlotModal(app, "Change Slot", str || "0", (result) => {
                if (result != "")
                    replaceLineInActiveFile(line, result);
                else
                    deleteLineInActiveFile(line);
            }).open();
        })
    }

    function initializeSortableSlots(tierListContainer: HTMLElement) {
        // Initialize Sortable for all tier-list-list elements
        tierListContainer.querySelectorAll('ul > li > ul').forEach(list => {
            Sortable.create(list as HTMLElement, {
                group: 'slot',
                animation: settings.animation,
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
            animation: settings.animation,
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

        el.findAll(":scope > ul > li > ul").forEach(list => {
            list.addEventListener("contextmenu", async (evt) => {
                evt.preventDefault();
                const menu = new Menu();
                const line = findDataLine(list) + list.children.length + 1;
        
                menu.addItem((item) => item.setTitle("Add Slot").setIcon("square-plus").onClick(() => {
                    new SlotModal(app, "Add Slot", "\t", (result) => {
                        if (result != "")
                            insertLineInActiveFile(line, result);
                    }).open();
                }));
                menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
            })
        })

        initializeSortableSlots(el);
        initializeSortableRows(el);
    }
}
