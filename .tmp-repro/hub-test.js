const fs = require('fs');
const path = require('path');
const { AiHub } = require('./aiViews.cjs');

const base = path.join(__dirname, 'hub-store');
const modelsDir = path.join(base, 'models');
const workspaceDir = path.join(base, 'workspace');
const extDir = path.join(base, 'ext');

let failed = 0;
const check = (name, cond, extra = '') => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
    if (!cond) { failed++; }
};
const gguf = (dir, name, mb) => {
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, name);
    fs.writeFileSync(p, Buffer.alloc(mb * 1024 * 1024));
    return p;
};

fs.rmSync(base, { recursive: true, force: true });
const kecil = gguf(modelsDir, 'model-kecil.gguf', 1);
const besar = gguf(path.join(modelsDir, 'sub', 'folder'), 'model-besar.gguf', 3);
gguf(path.join(modelsDir, 'node_modules'), 'lewati.gguf', 1);
const areaKerja = gguf(workspaceDir, 'model-workspace.gguf', 2);
gguf(extDir, 'model-tambahan.gguf', 2);

globalThis.__vscodeStub = {
    config: {
        'llama.port': 8081, 'llama.contextSize': 4096, 'llama.gpuLayers': 0, 'llama.threads': 0,
        'llama.extraArgs': '', 'llama.modelPaths': [modelsDir], 'llama.scanDepth': 2,
        'llama.scanTimeoutSeconds': 6, 'llama.autoScan': true,
        'ai.temperature': 0.2, 'ai.maxTokens': 0, 'ai.autoStartServer': true,
        'ai.includeStats': true, 'ai.systemExtra': '',
    },
    folders: [{ uri: { fsPath: workspaceDir } }],
};

const cache = {};
const makeCtx = () => ({
    extensionUri: { fsPath: extDir },
    globalState: { get: (k) => cache[k], update: async (k, v) => { cache[k] = v; } },
    workspaceState: { get: () => undefined, update: async () => undefined },
});
const makeChat = (events) => ({
    postModels: (p) => events.push({ t: 'models', p }),
    postScanStart: (phase) => events.push({ t: 'start', phase }),
    postScanProgress: (p) => events.push({ t: 'progress', p }),
    postServerStatus() { }, postContextList() { },
});

(async () => {
    const events = [];
    const hub = new AiHub(makeCtx());
    hub.attach(makeChat(events), { refresh() { }, appendLog() { } });

    check('cache awal kosong & tanpa I/O', hub.scanModels().length === 0);

    const t0 = Date.now();
    const hasil = await hub.refreshModels({ manual: true });
    const nama = hasil.map((m) => m.name);
    const paths = hasil.map((m) => m.path.toLowerCase());

    check('model di folder pengaturan, subfolder, workspace, dan folder ekstensi terdeteksi',
        ['model-kecil.gguf', 'model-besar.gguf', 'model-workspace.gguf', 'model-tambahan.gguf'].every((n) => nama.includes(n)),
        nama.join(', '));
    check('folder node_modules dilewati', !nama.includes('lewati.gguf'));
    check('tahap ringkas & penuh sama-sama dilaporkan', events.some((e) => e.t === 'start' && e.phase === 'ringkas') && events.some((e) => e.t === 'start' && e.phase === 'penuh'));
    check('kemajuan diposting ke view', events.some((e) => e.t === 'progress' && e.p.dirs > 0));
    const akhir = events.filter((e) => e.t === 'models' && e.p.done).pop();
    check('pesan daftar final (done) terkirim', !!akhir && akhir.p.list.length === hasil.length, akhir ? `${akhir.p.list.length} item` : 'tidak ada');
    check('model terbesar dipilih sebagai default', hub.selectedModel && hub.selectedModel.toLowerCase() === besar.toLowerCase(), hub.selectedModel);
    check('hasil disimpan untuk sesi berikutnya', (cache['dateSkunder.ggufCache']?.list || []).length === hasil.length);
    check('urutan: berkas terbesar di atas', paths[0] === besar.toLowerCase());

    // Daftar langsung tersedia di hub baru tanpa memindai disk lagi.
    const t1 = Date.now();
    const hub2 = new AiHub(makeCtx());
    const cepat = Date.now() - t1;
    check('hub baru memakai cache (daftar langsung terisi)', hub2.scanModels().length === hasil.length && cepat < 100, `${cepat} ms`);

    // Pemanggilan sinkron saat pemindaian berjalan tidak boleh memblokir.
    const probe = new AiHub(makeCtx());
    probe.attach(makeChat([]), { refresh() { }, appendLog() { } });
    const jalan = probe.refreshModels({ manual: true });
    const t2 = Date.now();
    probe.scanModels();
    const sinkron = Date.now() - t2;
    check('scanModels() sinkron tidak menyentuh disk', sinkron < 50, `${sinkron} ms`);
    const [r1, r2] = await Promise.all([probe.refreshModels({ manual: true }), jalan]);
    check('pemanggilan ganda tidak menjalankan pemindaian bersamaan', r1.length === r2.length, `${r1.length} vs ${r2.length}`);

    // Entri lama yang berkasnya sudah hilang tidak boleh tersisa.
    fs.rmSync(kecil);
    const setelahHapus = await hub.refreshModels({ manual: true });
    check('berkas yang dihapus hilang dari daftar', !setelahHapus.some((m) => m.name === 'model-kecil.gguf'), setelahHapus.map((m) => m.name).join(', '));

    // autoScan=false → pencarian otomatis tidak masuk tahap seluruh drive.
    globalThis.__vscodeStub.config['llama.autoScan'] = false;
    const eventsOff = [];
    const hub3 = new AiHub(makeCtx());
    hub3.attach(makeChat(eventsOff), { refresh() { }, appendLog() { } });
    await hub3.refreshModels({});
    check('autoScan=false melewati tahap seluruh drive', !eventsOff.some((e) => e.t === 'start' && e.phase === 'penuh'));
    globalThis.__vscodeStub.config['llama.autoScan'] = true;

    const viaProgress = await hub.scanWithProgress('uji');
    check('scanWithProgress mengembalikan daftar model', viaProgress.length > 0, `${viaProgress.length} berkas`);

    fs.rmSync(base, { recursive: true, force: true });
    console.log(failed === 0 ? '\nSEMUA UJI LULUS' : `\n${failed} UJI GAGAL`);
    process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('error uji:', e); process.exit(1); });
