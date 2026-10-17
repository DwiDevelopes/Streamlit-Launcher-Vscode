// Smoke test: muat dist/extension.js dengan stub 'vscode', lalu panggil activate()
// untuk memastikan registrasi view/perintah (termasuk fitur baru) berjalan tanpa galat.
const Module = require('module');
const path = require('path');

const stubPath = path.join(__dirname, 'vscode-activate-stub.js');
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (request === 'vscode') { return stubPath; }
    return original.call(this, request, ...rest);
};

const stub = require(stubPath);
const ext = require('../dist/extension.js');

const context = {
    extensionUri: { fsPath: path.join(__dirname, '..'), path: path.join(__dirname, '..') },
    subscriptions: [],
    globalState: { get: () => undefined, update: async () => { } },
    workspaceState: { get: () => undefined, update: async () => { } },
};

let failed = 0;
const check = (name, ok, detail) => {
    console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? ' — ' + detail : ''));
    if (!ok) { failed++; }
};

try {
    ext.activate(context);
    check('activate() berjalan tanpa galat', true);
} catch (e) {
    check('activate() berjalan tanpa galat', false, (e && e.stack ? e.stack.split('\n')[0] : String(e)));
}

const commands = stub.__registered.commands;
for (const id of ['date-skunder.exportPython', 'date-skunder.ai.voiceListen', 'date-skunder.ai.openChat', 'date-skunder.exportWorkflow']) {
    check('perintah terdaftar: ' + id, commands.includes(id), commands.join(', '));
}
check('view terdaftar (chat + llama)', stub.__registered.views.length === 2, String(stub.__registered.views.length));
check('custom editor terdaftar', stub.__registered.editors.includes('dateSkunder.viewer'));

console.log('');
console.log(failed === 0 ? 'SMOKE TEST LULUS' : failed + ' SMOKE TEST GAGAL');
process.exit(failed === 0 ? 0 : 1);
