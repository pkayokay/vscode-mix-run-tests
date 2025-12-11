import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    const toggleCommand = vscode.commands.registerCommand('mix-run-tests.toggle', toggleFile);
    const runTestCommand = vscode.commands.registerCommand('mix-run-tests.runTest', runTest);
    const runNearestTestCommand = vscode.commands.registerCommand('mix-run-tests.runNearestTest', runNearestTest);

    context.subscriptions.push(toggleCommand, runTestCommand, runNearestTestCommand);
}

export function deactivate() {}

/**
 * Toggle between source file and test file
 */
async function toggleFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const currentFile = editor.document.uri.fsPath;
    const targetFile = getToggleTarget(currentFile);

    if (!targetFile) {
        vscode.window.showWarningMessage('Could not determine target file');
        return;
    }

    if (!fs.existsSync(targetFile)) {
        vscode.window.showWarningMessage(`Target file does not exist: ${path.basename(targetFile)}`);
        return;
    }

    const doc = await vscode.workspace.openTextDocument(targetFile);
    await vscode.window.showTextDocument(doc);
}

/**
 * Get the target file for toggle (source <-> test)
 */
function getToggleTarget(currentFile: string): string | null {
    const fileName = path.basename(currentFile);
    const dir = path.dirname(currentFile);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(currentFile));

    if (!workspaceFolder) {
        return null;
    }

    const workspacePath = workspaceFolder.uri.fsPath;
    const relativePath = path.relative(workspacePath, dir);
    // Normalize path separators
    const normalizedRelative = relativePath.split(path.sep).join('/');

    // If it's a test file, return the source file
    if (fileName.endsWith('_test.exs')) {
        const sourceFileName = fileName.replace('_test.exs', '.ex');
        // Try lib/ directory first (common Phoenix structure)
        const pathWithoutTest = normalizedRelative.replace(/^test\//, '');
        const libPath = path.join(workspacePath, 'lib', ...pathWithoutTest.split('/'), sourceFileName);
        if (fs.existsSync(libPath)) {
            return libPath;
        }
        // Fallback to same directory
        return path.join(dir, sourceFileName);
    }

    // If it's a source file, return the test file
    if (fileName.endsWith('.ex') && !fileName.endsWith('_test.exs')) {
        const testFileName = fileName.replace('.ex', '_test.exs');
        // Try test/ directory first (common Phoenix structure)
        const pathWithoutLib = normalizedRelative.replace(/^lib\//, '');
        const testPath = path.join(workspacePath, 'test', ...pathWithoutLib.split('/'), testFileName);
        if (fs.existsSync(testPath)) {
            return testPath;
        }
        // Fallback to same directory
        return path.join(dir, testFileName);
    }

    return null;
}

/**
 * Run mix tests for the current file
 */
async function runTest() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const currentFile = editor.document.uri.fsPath;
    const testFile = getTestFile(currentFile);

    if (!testFile) {
        vscode.window.showWarningMessage('Could not determine test file');
        return;
    }

    if (!fs.existsSync(testFile)) {
        vscode.window.showWarningMessage(`Test file does not exist: ${path.basename(testFile)}`);
        return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, testFile);
    const command = `mix test ${relativePath}`;

    await runMixTest(command, workspaceFolder.uri.fsPath);
}

/**
 * Run the nearest test block
 */
async function runNearestTest() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const currentFile = editor.document.uri.fsPath;
    const testFile = getTestFile(currentFile);

    if (!testFile) {
        vscode.window.showWarningMessage('Could not determine test file');
        return;
    }

    if (!fs.existsSync(testFile)) {
        vscode.window.showWarningMessage(`Test file does not exist: ${path.basename(testFile)}`);
        return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    // If we're in a test file, find the nearest test block
    if (currentFile.endsWith('_test.exs')) {
        const cursorLine = editor.selection.active.line;
        const testLine = findNearestTestLine(editor.document, cursorLine);

        if (!testLine) {
            vscode.window.showWarningMessage('Could not find a test block at cursor position');
            return;
        }

        const relativePath = path.relative(workspaceFolder.uri.fsPath, testFile);
        const command = `mix test ${relativePath}:${testLine + 1}`; // mix test uses 1-based line numbers
        await runMixTest(command, workspaceFolder.uri.fsPath);
    } else {
        // If we're in a source file, run all tests in the corresponding test file
        const relativePath = path.relative(workspaceFolder.uri.fsPath, testFile);
        const command = `mix test ${relativePath}`;
        await runMixTest(command, workspaceFolder.uri.fsPath);
    }
}

/**
 * Get the test file for a given file (returns test file if input is source, or same file if already test)
 */
function getTestFile(filePath: string): string | null {
    const fileName = path.basename(filePath);
    const dir = path.dirname(filePath);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));

    // If it's already a test file, return it
    if (fileName.endsWith('_test.exs')) {
        return filePath;
    }

    // If it's a source file, return the test file
    if (fileName.endsWith('.ex') && !fileName.endsWith('_test.exs')) {
        if (workspaceFolder) {
            const workspacePath = workspaceFolder.uri.fsPath;
            const relativePath = path.relative(workspacePath, dir);
            const normalizedRelative = relativePath.split(path.sep).join('/');
            const testFileName = fileName.replace('.ex', '_test.exs');
            
            // Try test/ directory first (common Phoenix structure)
            const pathWithoutLib = normalizedRelative.replace(/^lib\//, '');
            const testPath = path.join(workspacePath, 'test', ...pathWithoutLib.split('/'), testFileName);
            if (fs.existsSync(testPath)) {
                return testPath;
            }
        }
        
        // Fallback to same directory
        const testFileName = fileName.replace('.ex', '_test.exs');
        return path.join(dir, testFileName);
    }

    return null;
}

/**
 * Find the line number of the nearest test block containing or above the cursor
 */
function findNearestTestLine(document: vscode.TextDocument, cursorLine: number): number | null {
    const text = document.getText();
    const lines = text.split('\n');

    // Look for test blocks: test "description" do
    // We'll find the test that contains the cursor line or is the closest one above
    let nearestTestLine: number | null = null;
    let lastTestStartLine: number | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Match: test "description" do or test "description", do: or describe "description" do
        // Also handle: test "description" do\n or test("description") do
        const testMatch = line.match(/^\s*(test\s+["']|describe\s+["']|test\s*\(["'])/);
        if (testMatch) {
            lastTestStartLine = i;
            // Find the matching end to determine if cursor is within this block
            const testEndLine = findTestBlockEnd(lines, i);
            
            // If cursor is within this test block, this is our match
            if (i <= cursorLine && cursorLine <= testEndLine) {
                nearestTestLine = i;
                break;
            }
        }
    }

    // If cursor is not within any test block, use the last test block before the cursor
    if (nearestTestLine === null && lastTestStartLine !== null && lastTestStartLine <= cursorLine) {
        nearestTestLine = lastTestStartLine;
    }

    return nearestTestLine;
}

/**
 * Find the end of a test block starting at startLine
 */
function findTestBlockEnd(lines: string[], startLine: number): number {
    const startIndent = lines[startLine].match(/^(\s*)/)?.[1].length || 0;
    let doFound = false;
    let doIndent = -1;

    // First, find the 'do' keyword (could be on same line or next line)
    for (let i = startLine; i < lines.length && i <= startLine + 2; i++) {
        const line = lines[i];
        if (line.match(/\bdo\b/)) {
            doFound = true;
            doIndent = line.match(/^(\s*)/)?.[1].length || 0;
            break;
        }
    }

    if (!doFound) {
        return lines.length - 1;
    }

    // Now find the matching 'end' at the same or less indentation
    for (let i = startLine + 1; i < lines.length; i++) {
        const line = lines[i];
        const currentIndent = line.match(/^(\s*)/)?.[1].length || 0;

        // Check for 'end' keyword at same or less indentation than 'do'
        if (line.match(/\bend\b/) && currentIndent <= doIndent) {
            return i;
        }
    }

    return lines.length - 1;
}

/**
 * Run mix test command in terminal
 */
async function runMixTest(command: string, cwd: string) {
    // Create or reuse terminal, ensuring we're in the correct directory
    let terminal = vscode.window.activeTerminal;
    
    if (!terminal) {
        const terminalOptions: vscode.TerminalOptions = {
            name: 'Mix Test',
            cwd: cwd
        };
        terminal = vscode.window.createTerminal(terminalOptions);
    } else {
        // If terminal exists, ensure we're in the right directory
        terminal.sendText(`cd "${cwd}"`, true);
    }
    
    terminal.sendText(command, true);
    terminal.show();
}

