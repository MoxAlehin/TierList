import {App} from 'obsidian';

export async function moveLinesInActiveFile(app: App, startIndex: number, count: number, newIndex: number, correction: boolean = true) {
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

export async function replaceLineInActiveFile(app: App, lineNumber: number, newText: string) {
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

export async function readLineFromActiveFile(app: App, lineNumber: number): Promise<string | null> {
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

export async function deleteLineInActiveFile(app: App, lineNumber: number) {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) return;

    const content = await app.vault.read(activeFile);
    const lines = content.split("\n");

    if (lineNumber < 0 || lineNumber >= lines.length) return; // Проверка границ

    lines.splice(lineNumber, 1); // Удаляем строку

    await app.vault.modify(activeFile, lines.join("\n")); // Записываем обратно
}

export async function insertLineInActiveFile(app: App, lineNumber: number, newText: string) {
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