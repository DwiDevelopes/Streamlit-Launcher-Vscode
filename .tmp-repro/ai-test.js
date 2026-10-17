/* Uji fungsional modul AI (bukan sekadar tipe): deteksi biner per-OS, pemindaian .gguf,
   manajer proses llama-server, klien chat streaming, dan penyusun konteks statistik. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const assert = require('assert');

const core = require('./ai-core.cjs');
const { osFolder, osLabel, resolveServerBinary, scanGgufModels, formatBytes, chatStream, LlamaServer, httpRequest } = core;
const { buildStatsContext, buildSystemPrompt, AnalysisStore, globalAnalysisStore } = require('./ai-store.cjs');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(name, fn) {
    try { fn(); console.log('  ✓ ' + name); pass++; }
    catch (e) { console.log('  ✗ ' + name + ' → ' + e.message); fail++; }
}
async function checkAsync(name, fn) {
    try { await fn(); console.log('  ✓ ' + name); pass++; }
    catch (e) { console.log('  ✗ ' + name + ' → ' + e.message); fail++; }
}

(async () => {
    console.log('[1] Deteksi folder biner per OS');
    check('win32 → win', () => assert.strictEqual(osFolder('win32'), 'win'));
    check('darwin → mac', () => assert.strictEqual(osFolder('darwin'), 'mac'));
    check('linux → linux', () => assert.strictEqual(osFolder('linux'), 'linux'));
    check('freebsd → tidak didukung', () => assert.strictEqual(osFolder('freebsd'), null));
    console.log('  label: ' + osLabel('win32'));

    console.log('[2] Biner llama-server di repo');
    const winInfo = resolveServerBinary(ROOT, 'win32');
    check('win/llama-server.exe terdeteksi', () => {
        assert.ok(winInfo.chosen, 'tidak ada kandidat yang cocok');
        assert.ok(/win[\\/]llama-server\.exe$/.test(winInfo.chosen), winInfo.chosen);
    });
    const macInfo = resolveServerBinary(ROOT, 'darwin');
    const linInfo = resolveServerBinary(ROOT, 'linux');
    check('mac/llama-server terdeteksi', () => assert.ok(macInfo.chosen && /mac[\\/]llama-server$/.test(macInfo.chosen), String(macInfo.chosen)));
    check('linux/llama-server terdeteksi', () => assert.ok(linInfo.chosen && /linux[\\/]llama-server$/.test(linInfo.chosen), String(linInfo.chosen)));

    console.log('[3] Pemindaian .gguf');
    const sandbox = path.join(__dirname, 'models');
    fs.rmSync(sandbox, { recursive: true, force: true });
    fs.mkdirSync(path.join(sandbox, 'sub', 'deep', 'deeper'), { recursive: true });
    fs.mkdirSync(path.join(sandbox, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(sandbox, 'alpha.gguf'), Buffer.alloc(2048, 1));
    fs.writeFileSync(path.join(sandbox, 'sub', 'beta.gguf'), Buffer.alloc(4096, 1));
    fs.writeFileSync(path.join(sandbox, 'sub', 'deep', 'deeper', 'gamma.gguf'), Buffer.alloc(1024, 1));
    fs.writeFileSync(path.join(sandbox, 'node_modules', 'abaikan.gguf'), Buffer.alloc(8192, 1));
    fs.writeFileSync(path.join(sandbox, 'bukan-model.txt'), 'x');
    fs.writeFileSync(path.join(sandbox, 'sub', 'model-00001-of-00002.gguf'), Buffer.alloc(512, 1));
    fs.writeFileSync(path.join(sandbox, 'sub', 'model-00002-of-00002.gguf'), Buffer.alloc(512, 1));

    const found = scanGgufModels([sandbox], { maxDepth: 4 });
    check('menemukan 5 berkas .gguf (node_modules dilewati)', () => assert.strictEqual(found.length, 5, 'jumlah: ' + found.length + ' → ' + found.map((f) => f.name).join(', ')));
    check('node_modules tidak dipindai', () => assert.ok(!found.some((f) => f.name === 'abaikan.gguf')));
    check('potongan 00001 diurutkan lebih dulu', () => {
        const i1 = found.findIndex((f) => f.name === 'model-00001-of-00002.gguf');
        const i2 = found.findIndex((f) => f.name === 'model-00002-of-00002.gguf');
        assert.ok(i1 >= 0 && i2 >= 0 && i1 < i2, `urutan ${i1} vs ${i2}`);
    });
    check('multipart ditandai', () => assert.ok(found.find((f) => f.name === 'model-00001-of-00002.gguf').multipart));
    check('ukuran terbesar lebih dulu (non-multipart)', () => assert.strictEqual(found[0].name, 'beta.gguf', String(found[0].name)));
    const shallow = scanGgufModels([sandbox], { maxDepth: 0 });
    check('maxDepth=0 hanya lapisan teratas', () => assert.deepStrictEqual(shallow.map((f) => f.name), ['alpha.gguf']));
    check('formatBytes', () => assert.strictEqual(formatBytes(2 * 1024 ** 3), '2.00 GB'));

    console.log('[4] Klien chat streaming (server tiruan format llama.cpp)');
    const chunkTexts = ['Pendapatan ', 'total 322.966,75 ', 'dari 1000 order.'];
    const stub = http.createServer((req, res) => {
        if (req.url === '/health') { res.writeHead(200); res.end('{"status":"ok"}'); return; }
        let i = 0;
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const timer = setInterval(() => {
            if (i < chunkTexts.length) {
                res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: chunkTexts[i] } }] }) + '\n\n');
                i++;
            } else {
                res.write('data: [DONE]\n\n');
                clearInterval(timer);
                res.end();
            }
        }, 60);
    });
    await new Promise((r) => stub.listen(0, '127.0.0.1', r));
    const stubPort = stub.address().port;

    const deltas = [];
    const stamps = [];
    const handle = chatStream({ port: stubPort, messages: [{ role: 'user', content: 'halo' }], onDelta: (t) => { deltas.push(t); stamps.push(Date.now()); } });
    const full = await handle.done;
    check('teks lengkap tergabung', () => assert.strictEqual(full, chunkTexts.join(''), JSON.stringify(full)));
    check('diterima bertahap (≥3 potongan)', () => assert.ok(deltas.length >= 3, 'potongan: ' + deltas.length));
    check('potongan tidak datang serentak', () => assert.ok(stamps[stamps.length - 1] - stamps[0] >= 80, 'selisih ' + (stamps[stamps.length - 1] - stamps[0]) + ' ms'));
    await checkAsync('abort menghentikan aliran', async () => {
        const h = chatStream({ port: stubPort, messages: [{ role: 'user', content: 'stop' }], onDelta: () => { } });
        h.abort();
        let rejected = false;
        try { await h.done; } catch { rejected = true; }
        assert.ok(rejected, 'promise tidak menolak setelah abort');
    });
    const health = await httpRequest(stubPort, '/health');
    check('httpRequest /health', () => assert.strictEqual(health.status, 200));

    console.log('[5] Manajer proses llama-server (biner nyata, model tidak valid)');
    const logs = [];
    const server = new LlamaServer({ extensionPath: ROOT, onLog: (l) => logs.push(l) });
    const fakeModel = path.join(__dirname, 'fake-invalid.gguf');
    fs.writeFileSync(fakeModel, Buffer.from('bukan berkas gguf sama sekali'));
    let thrown = null;
    try {
        await server.start({ modelPath: fakeModel, port: 18099, contextSize: 256, startupTimeoutMs: 25000 });
    } catch (e) { thrown = e; }
    check('start() melaporkan kegagalan model tidak valid', () => assert.ok(thrown, 'tidak melempar error'));
    check('status = error', () => assert.strictEqual(server.status.state, 'error', JSON.stringify(server.status)));
    check('log menangkap keluaran proses', () => assert.ok(logs.length >= 2, 'baris log: ' + logs.length));
    check('log memuat path biner sesuai OS', () => assert.ok(logs.some((l) => l.includes('llama-server')), logs.slice(0, 3).join(' | ')));
    check('argumen CLI benar', () => {
        const args = server.buildArgs({ modelPath: 'M.gguf', port: 8081, contextSize: 4096, gpuLayers: 8, threads: 4, extraArgs: ['--flash-attn'] });
        assert.strictEqual(args.join(' '), '-m M.gguf --host 127.0.0.1 --port 8081 -c 4096 -ngl 8 -t 4 --flash-attn');
    });
    const noBinary = new LlamaServer({ extensionPath: path.join(__dirname, 'tidak-ada'), platform: 'win32' });
    let msg = '';
    try { await noBinary.start({ modelPath: fakeModel, port: 18098, contextSize: 256 }); } catch (e) { msg = e.message; }
    check('pesan biner tidak ditemukan menyebut folder OS', () => assert.ok(/win[\\/]llama-server\.exe/.test(msg), msg));
    await server.stop();

    console.log('[6] Konteks statistik untuk chat');
    const payload = JSON.parse(fs.readFileSync(path.join(__dirname, 'payload.json'), 'utf8'));
    const store = new AnalysisStore();
    store.set('file:///supermarket.csv', payload, 'SuperMarket Analysis.csv');
    check('daftar konteks berisi entri', () => assert.strictEqual(store.list().length, 1));
    const ctx = buildStatsContext(store.last(), undefined, 7000);
    check('memuat pendapatan format Indonesia', () => assert.ok(ctx.includes('322.966,75'), 'tidak menemukan angka pendapatan'));
    check('memuat KPI, stok, dan decision tree', () => {
        assert.ok(/KPI bisnis/i.test(ctx), 'bagian KPI hilang');
        assert.ok(/Stok\/inventaris/i.test(ctx), 'bagian stok hilang');
        assert.ok(/Decision Tree/i.test(ctx), 'bagian decision tree hilang');
    });
    check('memuat aturan keputusan', () => assert.ok(/IF City = Yangon/i.test(ctx), 'aturan hilang'));
    check('panjang ≤ 7000 karakter', () => assert.ok(ctx.length <= 7000, 'panjang ' + ctx.length));
    const prompt = buildSystemPrompt(ctx, 'gunakan tabel bila perlu');
    check('system prompt memuat konteks + instruksi', () => assert.ok(prompt.includes('322.966,75') && /Bahasa Indonesia/.test(prompt) && /tabel bila perlu/.test(prompt)));
    check('store menyingkirkan entri terlama (>12)', () => {
        for (let i = 0; i < 15; i++) { store.set('id' + i, payload, 'f' + i); }
        assert.ok(store.list().length <= 12, 'jumlah: ' + store.list().length);
    });
    check('instans global tersedia untuk glue vscode', () => assert.ok(globalAnalysisStore instanceof AnalysisStore));

    console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`);
    stub.close();
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
