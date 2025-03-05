import { App } from 'obsidian';

export async function moveLinesInActiveFile(app: App, startIndex: number, count: number, newIndex: number, correction: boolean = true) {
    const file = app.workspace.getActiveFile();
    if (!file || startIndex == newIndex) {
        return;
    }

    await app.vault.process(file, content => {
        let lines = content.split("\n");
        const removedLines = lines.splice(startIndex, count);

        if (newIndex > startIndex && correction) {
            newIndex -= count;
        }

        lines.splice(newIndex, 0, ...removedLines);
        return lines.join("\n");
    })
}

export async function replaceLineInActiveFile(app: App, lineNumber: number, newText: string) {
    const file = app.workspace.getActiveFile();
    if (!file) return;

    await app.vault.process(file, content => {
        const lines = content.split("\n");
        lines[lineNumber] = newText;
        return lines.join("\n");
    })
}

export async function replaceLinesInActiveFile(
    app: App,
    startLine: number,
    lineCount: number,
    newLines: string[]
) {
    const file = app.workspace.getActiveFile();
    if (!file) return;

    await app.vault.process(file, content => {
        const lines = content.split("\n");
        lines.splice(startLine, lineCount, ...newLines);
        return lines.join("\n");
    })
}

export async function readLineFromActiveFile(app: App, lineNumber: number): Promise<string | null> {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) return null;

    const fileContent = await app.vault.read(activeFile);
    const lines = fileContent.split("\n");

    if (lineNumber < 0 || lineNumber >= lines.length) {
        return null;
    }

    return lines[lineNumber];
}

export async function deleteLineInActiveFile(app: App, lineNumber: number) {
    const file = app.workspace.getActiveFile();
    if (!file) return;

    await app.vault.process(file, content => {
        const lines = content.split("\n");
        lines.splice(lineNumber, 1);
        return lines.join("\n");
    })
}

export async function insertLineInActiveFile(app: App, lineNumber: number, newText: string) {
    const file = app.workspace.getActiveFile();
    if (!file) return;

    await app.vault.process(file, content => {
        const lines = content.split("\n");
        const index = Math.max(0, Math.min(lineNumber, lines.length));
        lines.splice(index, 0, newText);
        return lines.join("\n");
    })
}