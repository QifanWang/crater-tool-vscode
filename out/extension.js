"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterContent = exports.getFormatedTime = exports.getWebViewHTML = exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const path = require("path");
let terminalData = {};
/**
 * CraTer 工具声明了 2 个命令，分别是：
 * 1. crater.terminal 获取 Terminal 中的内容，并保存到 plugin/trace.txt 中
 * 2. crater.predict  运行 plugin/crater-tool.jar 得到预测结果
 *
 * 测试 CraTer 时请注意：
 * 1. 执行 CraTer 命令前请先 run/debug 一下 Java 代码，使得 Terminal 中生成所需的 stack trace 文本
 * 2. 执行 CraTer 命令时请按照 'crater.terminal' -> 'crater.predict' 的顺序
 */
function activate(context) {
    console.log('Yeah, CraTer is now activated :)');
    let options = vscode.workspace.getConfiguration('terminalCapture');
    terminalData = {};
    if (options.get('enable') === false) {
        console.log('Terminal Capture is disabled');
        return;
    }
    if (options.get('useClipboard') === false) {
        vscode.window.terminals.forEach(t => {
            registerTerminalForCapture(t);
        });
        vscode.window.onDidOpenTerminal(t => {
            registerTerminalForCapture(t);
        });
    }
    // 声明命令 crater.terminal: 捕获 Terminal 中的内容
    let terminalplay = vscode.commands.registerTextEditorCommand('crater.terminal', () => {
        console.log('>> command crater.terminal is working');
        if (options.get('enable') === false) {
            console.log('Command has been disabled, not running');
        }
        const terminals = vscode.window.terminals;
        if (terminals.length <= 0) {
            vscode.window.showWarningMessage('No terminals found, cannot run copy');
            return;
        }
        let tracePath = path.resolve(__dirname, '../src/plugin/trace.txt');
        tracePath = tracePath.replace(/\\/gi, '\/');
        if (options.get('useClipboard') === true) {
            // console.log('>> useClipboard mode');
            runClipboardMode();
        }
        else {
            // console.log('>> useCache mode');
            runCacheMode();
        }
    });
    // 声明命令 crater.predict : 预测 CraTer
    let prediction = vscode.commands.registerTextEditorCommand('crater.predict', (editor) => {
        var _a;
        console.log('>> command crater.predict is working');
        //// step-1: 获取编辑器所在的项目根目录的地址
        let projectPath = ((_a = vscode.workspace.getWorkspaceFolder(editor.document.uri)) === null || _a === void 0 ? void 0 : _a.uri.fsPath) + '/';
        projectPath = projectPath.replace(/\\/gi, '\/');
        // console.log('当前项目地址 : ' + projectPath);
        //// step-2: 将 Terminal 终端中的异常信息保存到堆栈迹文件中
        //// __dirname = 'crater/out/';
        let tracePath = path.resolve(__dirname, '../src/plugin/trace.txt');
        tracePath = tracePath.replace(/\\/gi, '\/');
        // console.log('  堆栈迹文件 : ' + tracePath);		
        //// step-3: 执行 crater-tool.jar 工具，并将结果展示在 WebView 中
        let jarPath = path.resolve(__dirname, '../src/plugin/crater-tool.jar');
        jarPath = jarPath.replace(/\\/gi, '\/');
        var cmdStr = `java -jar ${jarPath} -projPath ${projectPath} -projStackTrace ${tracePath}`;
        // console.log('CMD: ' + cmdStr);
        const process = require('child_process');
        process.exec(cmdStr, { cwd: 'C:/Users/yongfeng/Desktop/crater/src/plugin/' }, (err, stdout, stderr) => {
            let panel = vscode.window.createWebviewPanel('CraTer', 'CraTer Result', vscode.ViewColumn.One);
            panel.webview.html = getWebViewHTML(stdout, stderr);
        });
    });
    context.subscriptions.push(terminalplay);
    context.subscriptions.push(prediction);
}
exports.activate = activate;
function deactivate() {
    vscode.window.showInformationMessage('您已经成功写在了 CraTer 插件，拜拜！');
}
exports.deactivate = deactivate;
/**
 * 返回 WebView 页面的 html 代码，如果运行 crater-tool.jar 成功则显示 stdout 结果，否则显示 stderr 的结果。
 * @param stdout 正常的输出
 * @param stderr 异常的输出
 * @returns tempHTML，WebView 页面的 html 内容
 */
function getWebViewHTML(stdout, stderr) {
    let currTime = getFormatedTime();
    let tempHTML = `<h1 style='color:#23a8f2;font-weight:bold;' title='Crash Detecter'>CraTer 预测结果</h1>	
					<p style='font-size:15px;'>本页面展示了 CraTer 的分析和预测结果 (<span style='color:gray;'>本次运行时间：${currTime}</span>)。</p>
					<div style='font-size:15px'>${stdout}</div>`; // 正常的结果
    if (stderr) { // 异常的结果
        tempHTML += `<div style='font-size:15px'>
						<h3>3.Prediction Results: </h3>
						<p>Oops, CraTer failed to make the prediction of this crash. Please try to check the format of arguments.</p></div>`;
    }
    return tempHTML;
}
exports.getWebViewHTML = getWebViewHTML;
/**
 * 返回当前执行时间，如 2021-1-21 20:46:15
 * @returns currTime，当前格式化的时间
 */
function getFormatedTime() {
    let dates = new Date(Date.parse(new Date().toString()));
    const year = dates.getFullYear();
    const month = (dates.getMonth() + 1) < 10 ? '0' + (dates.getMonth() + 1) : (dates.getMonth() + 1);
    const day = dates.getDate() < 10 ? '0' + dates.getDate() : dates.getDate();
    const hour = dates.getHours();
    const minute = dates.getMinutes();
    const second = (dates.getSeconds() + 1) < 10 ? '0' + (dates.getSeconds()) : (dates.getSeconds());
    let currTime = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    return currTime;
}
exports.getFormatedTime = getFormatedTime;
///////////////////////////////////////////////////
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
    // vscode.commands.executeCommand('workbench.action.terminal.selectAll').then(() => {
    // 	vscode.commands.executeCommand('workbench.action.terminal.copySelection').then(() => {
    // 		vscode.commands.executeCommand('workbench.action.terminal.clearSelection').then(() => {
    // 			vscode.commands.executeCommand('workbench.action.files.newUntitledFile').then(() => {
    // 				vscode.commands.executeCommand('editor.action.clipboardPasteAction');
    // 			});
    // 		});
    // 	});
    // });
    vscode.commands.executeCommand('workbench.action.terminal.selectAll').then(() => {
        vscode.commands.executeCommand('workbench.action.terminal.copySelection').then(() => {
            vscode.commands.executeCommand('workbench.action.terminal.clearSelection').then(() => {
                vscode.env.clipboard.readText().then((text) => {
                    let lines = filterContent(text);
                    // console.log(lines);
                    // console.log(lines.length);
                    if (lines.length === 0) {
                        vscode.window.showInformationMessage('CraTer 提示：找不到终端中的 stack trace，请您先运行 Java 代码并生成相应的 Stack Trace');
                        return;
                    }
                    else {
                        const fs = require('fs');
                        let tracePath = path.resolve(__dirname, '../src/plugin/trace.txt');
                        tracePath = tracePath.replace(/\\/gi, '\/');
                        // console.log(tracePath);
                        let lastText = '';
                        for (var i = 0; i < lines.length; i++) {
                            lastText += lines[i] + '\n';
                        }
                        console.log(`copied stack trace: \n${lastText}`);
                        fs.writeFile(tracePath, lastText, (err) => {
                            if (err) {
                                console.error(err);
                                return;
                            }
                        });
                    }
                });
            });
        });
    });
}
function filterContent(text) {
    // 弃 Terminal 前半部的空行
    let filteredContent = new Array();
    let content = text.split('Windows PowerShell')[1];
    // 将 Terminal 内容按行分割
    content = content.replace(/\r\n/g, '\\r');
    content = content.replace(/\n/g, '\\r');
    content = content.replace(/\n\r/g, '\\r');
    let lines = content.split('\\r');
    if (lines.length < 1 || lines[1].startsWith('版权所有 (C) Microsoft Corporation。')) {
        return new Array();
    }
    // 收集最末尾的一个 stack trace
    const regeLine = /(.*)at (.*)\(.*\.java:\d*\)/g; // 每一行必须符合要求， e.g., at xxx.xx.(xx.java:101)
    var i = lines.length - 2;
    for (; i >= 0; i--) {
        if (lines[i].startsWith('Exception') || lines[i].startsWith('Exception')) {
            filteredContent.push(lines[i]);
            break;
        }
        if (lines[i].match(regeLine)) {
            filteredContent.push('\t' + lines[i].trim());
        }
    }
    filteredContent = filteredContent.reverse();
    return filteredContent;
}
exports.filterContent = filterContent;
function cleanupCacheData(data) {
    return data.replace(new RegExp('\x1b\[[0-9;]*m', 'g'), '');
}
function registerTerminalForCapture(terminal) {
    terminal.processId.then(terminalId => {
        terminalData[terminalId ? terminalId : -1] = "";
        terminal.onDidWriteData((data) => {
            // TODO:
            //   - Need to remove (or handle) backspace
            //   - not sure what to do about carriage return???
            //   - might have some odd output
            terminalData[terminalId ? terminalId : -1] += data;
        });
    });
}
//# sourceMappingURL=extension.js.map