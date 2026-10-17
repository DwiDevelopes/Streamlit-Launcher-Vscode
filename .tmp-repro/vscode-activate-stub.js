// Stub API 'vscode' secukupnya untuk smoke test aktivasi ekstensi.
const path = require('path');
const registered = { commands: [], views: [], editors: [] };

function uri(fsPath) {
    return {
        fsPath: fsPath,
        path: fsPath.replace(/\\/g, '/'),
        scheme: 'file',
        toString: () => 'file://' + fsPath.replace(/\\/g, '/'),
        with: (patch) => uri(patch && patch.path ? patch.path : fsPath),
    };
}

const stub = {
    Uri: {
        file: (p) => uri(p),
        parse: (s) => uri(String(s)),
        joinPath: (base, ...parts) => uri(path.join(base.fsPath || base.path, ...parts)),
    },
    workspace: {
        getConfiguration: () => ({ get: () => undefined, update: async () => { } }),
        createFileSystemWatcher: () => ({ onDidChange: () => ({ dispose() { } }), dispose() { } }),
        workspaceFolders: [],
        fs: {},
    },
    window: {
        registerWebviewViewProvider: (id) => { registered.views.push(id); return { dispose() { } }; },
        registerCustomEditorProvider: (id) => { registered.editors.push(id); return { dispose() { } }; },
        showWarningMessage: async () => undefined,
        showInformationMessage: async () => undefined,
        showErrorMessage: () => undefined,
        withProgress: async (_opts, task) => task({ report() { } }, { onCancellationRequested() { } }),
        activeTextEditor: undefined,
        tabGroups: { activeTabGroup: { activeTab: undefined } },
        createWebviewPanel: undefined,
    },
    commands: {
        registerCommand: (id) => { registered.commands.push(id); return { dispose() { } }; },
        executeCommand: async () => undefined,
    },
    env: { openExternal: async () => true },
    ProgressLocation: { Notification: 15 },
    ConfigurationTarget: { Global: 1, Workspace: 2 },
    RelativePattern: class { constructor(base, pattern) { this.base = base; this.pattern = pattern; } },
    TabInputCustom: class { }, TabInputText: class { },
};

module.exports = stub;
module.exports.__registered = registered;
