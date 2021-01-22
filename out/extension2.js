"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
// Common data to be used elsewhere
let terminalData = {};
function activate(context) {
    let options = vscode.workspace.getConfiguration('terminalCapture');
    terminalData = {};
    if (options.get('enable') === false) {
        console.log('Terminal Capture is disabled');
        return;
    }
    console.log('Terminal Capture extension is now active');
    if (options.get('useClipboard') === false) {
        vscode.window.terminals.forEach(t => {
            registerTerminalForCapture(t);
        });
        vscode.window.onDidOpenTerminal(t => {
            registerTerminalForCapture(t);
        });
    }
    context.subscriptions.push(vscode.commands.registerCommand('extension.terminalCapture.runCapture', () => {
        if (options.get('enable') === false) {
            console.log('Command has been disabled, not running');
        }
        const terminals = vscode.window.terminals;
        if (terminals.length <= 0) {
            vscode.window.showWarningMessage('No terminals found, cannot run copy');
            return;
        }
        if (options.get('useClipboard') === true) {
            runClipboardMode();
        }
        else {
            runCacheMode();
        }
    }));
}
exports.activate = activate;
function deactivate() {
    terminalData = {};
}
exports.deactivate = deactivate;
function runCacheMode() {
    let terminal = vscode.window.activeTerminal;
    if (terminal === undefined) {
        vscode.window.showWarningMessage('No active terminal found, can not capture');
        return;
    }
    terminal.processId.then(terminalId => {
        vscode.commands.executeCommand('workbench.action.files.newUntitledFile').then(() => {
            let editor = vscode.window.activeTextEditor;
            if (editor === undefined) {
                vscode.window.showWarningMessage('Failed to find active editor to paste terminal content');
                return;
            }
            let cache = cleanupCacheData(terminalData[terminalId ? terminalId : 0]);
            editor.edit(builder => {
                builder.insert(new vscode.Position(0, 0), cache);
            });
        });
    });
}
function runClipboardMode() {
    vscode.commands.executeCommand('workbench.action.terminal.selectAll').then(() => {
        vscode.commands.executeCommand('workbench.action.terminal.copySelection').then(() => {
            vscode.commands.executeCommand('workbench.action.terminal.clearSelection').then(() => {
                vscode.commands.executeCommand('workbench.action.files.newUntitledFile').then(() => {
                    vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                });
            });
        });
    });
}
function cleanupCacheData(data) {
    return data.replace(new RegExp('\x1b\[[0-9;]*m', 'g'), '');
}
function registerTerminalForCapture(terminal) {
    terminal.processId.then(terminalId => {
        terminalData[terminalId ? terminalId : 0] = "";
        terminal.onDidWriteData((data) => {
            // TODO:
            //   - Need to remove (or handle) backspace
            //   - not sure what to do about carriage return???
            //   - might have some odd output
            terminalData[terminalId ? terminalId : 0] += data;
        });
    });
}
//# sourceMappingURL=extension2.js.map