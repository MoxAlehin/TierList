import { MarkdownPostProcessorContext, Menu } from 'obsidian';
import Sortable from 'sortablejs';
import {
    moveLinesInActiveFile,
    replaceLineInActiveFile,
    readLineFromActiveFile,
    deleteLineInActiveFile,
    insertLineInActiveFile,
    replaceLinesInActiveFile
} from 'utils/file-utils';
import { SlotModal } from 'modals/slot-modal';
import { DataviewSearchModal } from 'modals/request-modal'
import { TierListSettings, setSetting } from 'settings';
import { getAPI } from "obsidian-dataview";
import { LocalSettingsModal } from 'modals/local-settings-modal';
import TierListPlugin from 'main';
import { renderSlot } from 'utils/render-utils';

export function redraw(el: HTMLElement, settings: TierListSettings) {
    el.style.setProperty('--tier-list-width-ratio', `${settings.width / 100}`);
    el.style.setProperty('--screen-width', `${screen.width}px`);
    el.style.setProperty('--tier-list-slot-count', `${settings.slots}`);
    el.style.setProperty('--tier-list-aspect-ratio', `${settings.ratio}`);
    if (settings.fontSize && settings.fontSize.trim() !== '') {
        el.style.setProperty('--tier-list-font-size', settings.fontSize);
    } else {
        el.style.removeProperty('--tier-list-font-size');
    }
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

export async function searchFiles(from: string, where: string): Promise<string[]> {
    const dv = getAPI();
    if (!dv) return [];

    try {
        let query = `LIST FROM ${from}`;
        if (where) query += ` WHERE ${where}`;
        const result = await dv.query(query);
        return result.value.values.map((p: { path: any; }) => dv.page(p.path).file.name);

    } catch (error) {
        console.log(error.message);
        return [];
    }
}

export function generateTierListPostProcessor(plugin: TierListPlugin): (tierList: HTMLElement, ctx: MarkdownPostProcessorContext) => void {
    const app = plugin.app;
    let scroll = 0;

    return async (tierList: HTMLElement, ctx: MarkdownPostProcessorContext) => {

        // Tier List Check
        const tagEl: HTMLElement = tierList.find(`a[href="${plugin.settings.tag}"]`);
        if (!tagEl)
            return;
        tagEl.remove();

        const sectionInfo = ctx.getSectionInfo(tierList);
        if (!sectionInfo)
            return;

        const localSettings: TierListSettings = { ...plugin.settings };
        const scrollableEl = document.documentElement.find('.markdown-preview-view');
        scrollableEl.scrollTo(0, scroll);

        function toPascalCase(str: string): string {
            return str.charAt(0).toUpperCase() + str.slice(1);
        }

        async function writeSetting(key: string, value: string) {
            const settingsList = tierList.find(".settings");
            const pascalKey = toPascalCase(key);
            const valueText = `\t- ${pascalKey}: ${value}`;
            if (settingsList) {
                for (const setting of settingsList.findAll('li')) {
                    const text = setting.textContent || '';
                    const [fileKey, fileValue] = text.split(':').map(item => item.trim());
                    if (fileKey.toLowerCase() == key.toLowerCase()) {
                        const settingLine = findDataLine(setting);
                        scroll = scrollableEl.scrollTop;
                        await replaceLineInActiveFile(app, settingLine, valueText);
                        return;
                    }
                }
                const settingLine = findDataLine(settingsList) + 1;
                scroll = scrollableEl.scrollTop;
                await insertLineInActiveFile(app, settingLine, valueText);
            }
            else {
                // if (sectionInfo) {
                //     const line = sectionInfo.lineEnd || 0;
                //     await insertLineInActiveFile(app, line + 1, `- ${localSettings.settings}`);
                //     await insertLineInActiveFile(app, line + 2, valueText);
                // }
            }
        }

        async function writeSettings(settings: Partial<TierListSettings>) {
            const settingsList = tierList.find(".settings");
            settings = Object.fromEntries(
                Object.entries(settings).filter(([key, value]) =>
                    plugin.settings[key as keyof TierListSettings] !== value
                ));
            const values = Object.entries(settings)
                .map(([key, value]) => `\t- ${toPascalCase(key)}: ${value}`);
            if (settingsList) {
                const settingLine = findDataLine(settingsList) + 1;
                scroll = scrollableEl.scrollTop;
                await replaceLinesInActiveFile(app, settingLine, settingsList.find("ul").children.length, values);
            }
            else {
                values.unshift(`- ${localSettings.settings}`);
                const settingsLine = ctx.getSectionInfo(tierList)?.lineEnd || 0;
                scroll = scrollableEl.scrollTop;
                await insertLineInActiveFile(app, settingsLine + 1, values.join('\n'));
            }
        }

        async function prepareSlot(slot: HTMLElement) {
            renderSlot(plugin, localSettings, slot)
            slot.addEventListener("contextmenu", async (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                const menu = new Menu();
                const line = findDataLine(slot);
                await addSlotContextMenuOptions(menu, line);
                menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
            })

            addClickHandler(slot);
            addCursorChangeHandler(slot);
        }

        function addCursorChangeHandler(slot: HTMLElement) {
            slot.addEventListener('mouseover', (event: MouseEvent) => {
                if (event.ctrlKey || event.metaKey) {
                    slot.classList.add('help-cursor');
                }
            });

            slot.addEventListener('mouseout', (event: MouseEvent) => {
                slot.classList.remove('help-cursor');
            });

            slot.addEventListener('mousemove', (event: MouseEvent) => {
                if (event.ctrlKey || event.metaKey) {
                    slot.classList.add('help-cursor');
                } else {
                    slot.classList.remove('help-cursor');
                }
            });
        }

        function addClickHandler(slot: HTMLElement) {
            slot.addEventListener('click', (event: MouseEvent) => {
                event.preventDefault();
                if (slot.find('.excalidraw-embedded-img')) {
                    event.stopPropagation();
                    return;
                }

                if (event.ctrlKey || event.metaKey) {
                    event.stopPropagation();

                    const link = slot.find('a.internal-link, a.external-link');

                    if (slot.hasAttribute('href')) {
                        const href = slot.getAttr('href') || '';
                        const file = app.metadataCache.getFirstLinkpathDest(href, '');
                        if (file) {
                            app.workspace.openLinkText(href, file.path);
                        }
                    }
                    else if (link) {
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
                                const isExternal = src.startsWith('http://') || src.startsWith('https://');
                                console.log(src)
                                if (isExternal) {
                                    window.open(src, '_blank');
                                } else {
                                    const match = decodeURIComponent(src).match(/.*[\\\/]([\d\w\.]*)\??/);
                                    if (match) {
                                        const href = match[1];
                                        const file = app.metadataCache.getFirstLinkpathDest(href, '');
                                        if (file) {
                                            app.workspace.openLinkText(href, file.path);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            slot.addEventListener("dblclick", async (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                const line = findDataLine(slot);
                const str = await readLineFromActiveFile(app, line);
                new SlotModal(plugin, localSettings, "Change slot", str || "0", async (result) => {
                    scroll = scrollableEl.scrollTop;
                    if (result != "")
                        await replaceLineInActiveFile(app, line, result);
                    else
                        await deleteLineInActiveFile(app, line);
                }).open();
            })
        }

        async function addMissingSlots(names: string[], line: number) {
            names = await filterTierListNames(names);
            const text = names.map(name => `\t- [[${name}]]`).join("\n");

            if (text) {
                scroll = scrollableEl.scrollTop;
                await insertLineInActiveFile(app, line, text);
            }
        }

        function addListContextMenuOptions(menu: Menu, line: number) {
            menu.addItem((item) => item.setTitle("Add slot").setIcon("square-plus").onClick(() => {
                new SlotModal(plugin, localSettings, "Add slot", "\t", async (result) => {
                    if (result != "") {
                        scroll = scrollableEl.scrollTop;
                        await insertLineInActiveFile(app, line, result);
                    }
                }).open();
            }));

            menu.addItem((item) => item.setTitle("Settings").setIcon("settings").onClick(() => {
                new LocalSettingsModal(app, localSettings, (updatedSettings: Partial<TierListSettings>) => {
                    scroll = scrollableEl.scrollTop;
                    writeSettings(updatedSettings);
                }).open();
            }))

            // Dataview options
            const dv = getAPI();
            if (!dv) return;

            menu.addItem((item) => item.setTitle("Request").setIcon("search").onClick(() => {
                new DataviewSearchModal(app, localSettings.from, localSettings.where, async (names, from, where) => {
                    await writeSetting("Where", where);
                    await writeSetting("From", from);
                    addMissingSlots(names, line);
                }).open();
            }));

            if (localSettings.from) {
                menu.addItem((item) => item.setTitle("Add missing").setIcon("database").onClick(async () => {
                    const names = await searchFiles(localSettings.from, localSettings.where);
                    addMissingSlots(names, line);
                }))
            }
        }

        async function addSlotContextMenuOptions(menu: Menu, line: number) {
            const str = await readLineFromActiveFile(app, line);
            menu.addItem((item) => item.setTitle("Edit slot").setIcon("pencil").onClick(() => {
                new SlotModal(plugin, localSettings, "Change slot", str || "0", async (result) => {
                    if (result != "") {
                        scroll = scrollableEl.scrollTop;
                        await replaceLineInActiveFile(app, line, result);
                    }
                    else {
                        scroll = scrollableEl.scrollTop;
                        await deleteLineInActiveFile(app, line);
                    }
                }).open();
            }));
            menu.addItem((item) => {
                (item as any).dom.addClass("is-warning");
                item.setTitle("Delete slot").setIcon("trash-2").onClick(async () => {
                    scroll = scrollableEl.scrollTop;
                    await deleteLineInActiveFile(app, line);
                })
            });
            menu.addItem((item) => {
                item.setTitle("Duplicate slot").setIcon("copy").onClick(async () => {
                    scroll = scrollableEl.scrollTop;
                    await insertLineInActiveFile(app, line, await readLineFromActiveFile(app, line) || '');
                })
            });
            addListContextMenuOptions(menu, line);
        }

        async function initializeSlots() {
            // Initialize Sortable for all Slots elements

            for (const list of tierList.findAll('ul > li > ul')) {
                Sortable.create(list as HTMLElement, {
                    group: `slot-${sectionInfo?.lineStart}`,
                    animation: localSettings.animation,
                    fallbackOnBody: true,
                    forceFallback: true,
                    onEnd: async (evt) => {
                        const tierListLine = parseInt(evt.item.parentElement?.parentElement?.parentElement?.parentElement?.getAttr("data-line") || "0");
                        const parentLine = parseInt(evt.item.parentElement?.parentElement?.getAttr("data-line") || "0", 10);
                        const newIndex = evt.newIndex || 0;
                        const oldParentIndex = parseInt(evt.from.parentElement?.getAttr("data-line") || "0");
                        const oldIndex = evt.oldIndex || 0;

                        let newLine = tierListLine + parentLine + newIndex + 1;
                        let oldLine = tierListLine + oldParentIndex + oldIndex + 1;
                        if (oldLine < newLine && oldParentIndex == parentLine)
                            newLine = newLine + 1;

                        scroll = scrollableEl.scrollTop;
                        await moveLinesInActiveFile(app, oldLine, 1, newLine);
                    }
                });
                // Add Context Menu for lists
                list.addEventListener("contextmenu", async (evt) => {
                    evt.preventDefault();
                    const menu = new Menu();
                    const line = findDataLine(list) + list.children.length + 1;
                    addListContextMenuOptions(menu, line);
                    menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
                })
                list.addEventListener("dblclick", (evt) => {
                    evt.preventDefault();
                    const line = findDataLine(list) + list.children.length + 1;
                    new SlotModal(plugin, localSettings, "Add slot", "\t", async (result) => {
                        if (result != "") {
                            scroll = scrollableEl.scrollTop;
                            await insertLineInActiveFile(app, line, result);
                        }
                    }).open();
                })
                for (const li of list.findAll("li")) {
                    prepareSlot(li);
                }
            };
        }

        function initializeRows() {
            Sortable.create(tierList.find(":scope > ul"), {
                handle: '.tier-list-tier',
                group: `tier-${sectionInfo?.lineStart}`,
                animation: localSettings.animation,
                onEnd: async (evt) => {
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

                    if (newIndex >= oldIndex) {
                        newLine = newLine + oldChildLength - length;
                    }

                    scroll = scrollableEl.scrollTop;
                    await moveLinesInActiveFile(app, oldLine, length, newLine, false);
                }
            });
        }

        async function initializeTierSlots() {
            const listItems = tierList.findAll(":scope > ul > li");
            for (const li of listItems.reverse()) {
                let text: string = "";
                let unordered: boolean = false;
                li.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        if (node.nodeValue && node.nodeValue.trim() == localSettings.settings.trim()) {
                            settingsProcessing(li, localSettings);
                        }

                        else if (node.nodeValue?.contains(localSettings.unordered)) {
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
                    tierDiv.addClass("tier-list-tier");
                    tierDiv.textContent = text;

                    Array.from(li.childNodes).forEach(node => {
                        if (node != innerList) {
                            tierDiv.appendChild(node);
                        }
                    })

                    li.prepend(tierDiv);
                    await prepareSlot(tierDiv);
                }
                else {
                    li.find("ul").addClass("unordered");
                }
            }
        }

        function toCamelCase(str: string): string {
            return str.charAt(0).toLowerCase() + str.slice(1);
        }

        function settingsProcessing(list: HTMLElement, settings: TierListSettings) {
            list.addClass("settings");
            const pairs: { [key: string]: string } = {};

            list.findAll('li').forEach(setting => {
                const text = setting.textContent || '';
                const [key, value] = text.split(':').map(item => item.trim());
                if (key && value) {
                    pairs[toCamelCase(key)] = value;
                }
            });

            for (const [key, value] of Object.entries(pairs)) {
                setSetting(key, value, settings);
            }
        }

        async function filterTierListNames(names: string[]): Promise<string[]> {
            if (!sectionInfo) return names;

            const activeFile = app.workspace.getActiveFile();
            if (!activeFile) return names;
            const fileContent = await app.vault.read(activeFile);

            const tierListLines = fileContent.split("\n").slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1);

            function extractName(line: string): string | null {
                line = line.trim();
                if (!line.startsWith("- ")) return null;
                line = line.substring(2);

                line = line.replace(/<span[^>]*>(.*?)<\/span>/g, "$1");

                line = line.replace(/^!+/, "");

                const matchBracket = line.match(/^\[\[(.*?)(?:\s*\|\s*.*?)?\]\]/);
                if (matchBracket) return matchBracket[1];

                const matchParens = line.match(/^\[[^\]]*\]\((.*?)\)/);
                if (matchParens) return matchParens[1];

                return line;
            }

            const existingNames = new Set<string>();
            for (const line of tierListLines) {
                const name = extractName(line);
                if (name) existingNames.add(name);
            }

            return names.filter(name => !existingNames.has(name));
        }

        // HTML cleanup
        tierList.setAttr("data-line", sectionInfo.lineStart || 0);
        tierList.addClass("tier-list");
        tierList.findAll(".list-bullet").forEach(span => span.remove());
        tierList.findAll(".list-collapse-indicator").forEach(span => span.remove());
        tierList.findAll(":scope > ul > li:not(:has(ul))").forEach(list => {
            const newul = document.createElement("ul");
            list.appendChild(newul);
        })

        await initializeTierSlots();
        await initializeSlots();
        await initializeRows();

        redraw(document.documentElement, localSettings);
        scrollableEl.scrollTo(0, scroll);
    }
}
