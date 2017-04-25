'use strict';
import {
    workspace, languages, window, commands, ExtensionContext, Disposable, QuickPickItem,
    Uri, Event, EventEmitter
} from 'vscode';
import { format } from 'util';
import * as path from 'path';
import * as cp from 'child_process';
import * as os from 'os';
import {DebugProtocol} from 'vscode-debugprotocol';

interface LongPollResponse extends DebugProtocol.Response {
    body: {
        event: string;
        body: any
    }
}

interface ProvideContentResponse extends DebugProtocol.Response {
    body: {
        content: string;
    }
}

export function activate(context: ExtensionContext) {
    context.subscriptions.push(commands.registerCommand('lldb.getAdapterExecutable',
        () => getAdapterExecutable(context)));
    context.subscriptions.push(commands.registerCommand('lldb.startDebugSession',
        (args) => startDebugSession(context, args)));
    context.subscriptions.push(commands.registerCommand('lldb.showDisassembly',
        () => showDisassembly(context)));
    context.subscriptions.push(commands.registerCommand('lldb.toggleDisassembly',
        () => toggleDisassembly(context)));
    context.subscriptions.push(commands.registerCommand('lldb.displayFormat',
        () => displayFormat(context)));
    context.subscriptions.push(commands.registerCommand('lldb.launchDebugServer',
        () => launchDebugServer(context)));
    context.subscriptions.push(commands.registerCommand('lldb.pickProcess',
        () => pickProcess(context, false)));
    context.subscriptions.push(commands.registerCommand('lldb.pickMyProcess',
        () => pickProcess(context, true)));
    context.subscriptions.push(workspace.registerTextDocumentContentProvider('debugger', {
        get onDidChange(): Event<Uri> {
            return previewContentChanged.event;
        },
        async provideTextDocumentContent(uri): Promise<string> {
            return provideHtmlContent(uri);
        }
    }));
}

async function startDebugSession(context: ExtensionContext, config: any) {
    await commands.executeCommand('vscode.startDebug', config);
    pollForEvents();
}

async function getAdapterExecutable(context: ExtensionContext): Promise<any> {
    let config = workspace.getConfiguration('lldb');
    let lldbPath = config.get('executable', 'lldb');

    let lldbLog = config.get('log', null);
    var logging = '';
    if (lldbLog) {
        var logPath = 'None';
        var logLevel = 0;
        if (typeof (lldbLog) == 'string') {
            logPath = lldbLog;
        } else {
            logPath = lldbLog.path;
            logLevel = lldbLog.level;
        }
        logging = format('log_file=\'b64:%s\',log_level=%d',
            new Buffer(logPath).toString('base64'), logLevel);
    }

    let adapterPath = path.join(context.extensionPath, 'adapter');
    return {
        command: lldbPath,
        args: ['-b', '-Q',
            '-O', format('command script import \'%s\'', adapterPath),
            '-O', format('script adapter.main.run_stdio_session(%s)', logging)
        ]
    }
}

async function launchDebugServer(context: ExtensionContext) {
    let config = workspace.getConfiguration('lldb');
    let lldbPath = config.get('executable', 'lldb');

    let terminal = window.createTerminal('LLDB Debug Server');
    let adapterPath = path.join(context.extensionPath, 'adapter');
    let command =
        format('lldb -b -O "command script import \'%s\'" ', adapterPath) +
        format('-O "script adapter.main.run_tcp_server()"\n');
    terminal.sendText(command);
}

// Long-polls the adapter for asynchronous events directed at this extension.
async function pollForEvents() {
    while (true) {
        let response = await commands.executeCommand<LongPollResponse>('workbench.customDebugRequest', 'longPoll', {});
        if (response === undefined) {
            break; // Debug session has ended.
        }
        if (response.body.event == 'displayHtml') {
            await onDisplayHtml(response.body.body);
        }
    }
}

async function showDisassembly(context: ExtensionContext) {
    let selection = await window.showQuickPick(['always', 'auto', 'never']);
    commands.executeCommand('workbench.customDebugRequest', 'showDisassembly', { value: selection });
}

async function toggleDisassembly(context: ExtensionContext) {
    commands.executeCommand('workbench.customDebugRequest', 'showDisassembly', { value: 'toggle' });
}

async function displayFormat(context: ExtensionContext) {
    let selection = await window.showQuickPick(['auto', 'hex', 'decimal', 'binary']);
    commands.executeCommand('workbench.customDebugRequest', 'displayFormat', { value: selection });
}

async function pickProcess(context: ExtensionContext, currentUserOnly: boolean): Promise<number> {
    let is_windows = process.platform == 'win32';
    var command: string;
    if (!is_windows) {
        if (currentUserOnly)
            command = 'ps x';
        else
            command = 'ps ax';
    } else {
        if (currentUserOnly)
            command = 'tasklist /V /FO CSV /FI "USERNAME eq ' + process.env['USERNAME'] + '"';
        else
            command = 'tasklist /V /FO CSV';
    }
    let stdout = await new Promise<string>((resolve, reject) => {
        cp.exec(command, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout)
        })
    });
    let lines = stdout.split('\n');
    let items: (QuickPickItem & { pid: number })[] = [];

    var re: RegExp, idx: number[];
    if (!is_windows) {
        re = /^\s*(\d+)\s+.*?\s+.*?\s+.*?\s+(.*)()$/;
        idx = [1, 2, 3];
    } else {
        // name, pid, ..., window title
        re = /^"([^"]*)","([^"]*)",(?:"[^"]*",){6}"([^"]*)"/;
        idx = [2, 1, 3];
    }
    for (var i = 1; i < lines.length; ++i) {
        let groups = re.exec(lines[i]);
        if (groups) {
            let pid = parseInt(groups[idx[0]]);
            let name = groups[idx[1]];
            let descr = groups[idx[2]];
            let item = { label: format('%d: %s', pid, name), description: descr, pid: pid };
            items.unshift(item);
        }
    }
    let item = await window.showQuickPick(items);
    if (item) {
        return item.pid;
    } else {
        throw Error('Cancelled');
    }
}

/// HTML display stuff ///

var previewContent: any = {};
var previewContentChanged: EventEmitter<Uri> = new EventEmitter<Uri>();

async function onDisplayHtml(body: any) {
    previewContent = body.content; // Sets a global.
    for (var uri in body.content) {
        previewContentChanged.fire(<any>uri);
    }
    await commands.executeCommand('vscode.previewHtml', body.uri, body.position, body.title);
}

async function provideHtmlContent(uri: Uri) {
    let uriString = uri.toString();
    if (previewContent.hasOwnProperty(uriString)) {
        return previewContent[uriString];
    }
    let result = await commands.executeCommand<ProvideContentResponse>(
        'workbench.customDebugRequest', 'provideContent', { uri: uriString });
    if (result === undefined) {
        return "Not available";
    } else {
        return result.body.content;
    }
}
