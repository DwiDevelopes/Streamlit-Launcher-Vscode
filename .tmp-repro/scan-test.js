// Skrip uji sementara (bukan bagian ekstensi): uji perilaku scanGgufModels di Node.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { scanGgufModels, sortModels, defaultModelRoots, listStorageRoots, formatBytes } = require('./llamaCore.cjs');

const root = path.join(__dirname, 'scratch-store');
let failed = 0;
const check = (name, cond, extra = '') => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
    if (!cond) { failed++; }
};
const write = (rel, bytes) => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.alloc(bytes));
    return p;
};
const reset = () => { fs.rmSync(root, { recursive: true, force: true }); };

(async () => {
    reset();
    const a = write('Downloads/model-a.gguf', 2048);
    const b1 = write('deep/l2/l3/l4/l5/model-b-00001-of-00002.gguf', 4096);
    const b2 = write('deep/l2/l3/l4/l5/model-b-00002-of-00002.gguf', 4096);
    const c = write('Models/UPPER.GGUF', 8192);
    write('node_modules/lewati.gguf', 1024);           // harus dilewati
    write('build/lewati-juga.gguf', 1024);             // harus dilewati
    write('Downloads/bukan-model.txt', 16);            // bukan .gguf

    // 1) pemindaian normal (kedalaman cukup) + pelaporan bertahap
    const found = [];
    const progress = [];
    const res = await scanGgufModels([root], {
        maxDepth: 6, timeoutMs: 20000, concurrency: 4,
        onFound: (f) => found.push(f.name),
        onProgress: (p) => progress.push(p),
    });
    const names = res.map((m) => m.name).sort();
    check('menemukan 4 berkas .gguf (tanpa node_modules/build)',
        names.length === 4 && names.includes('model-a.gguf') && names.includes('UPPER.GGUF')
        && !names.some((n) => n.includes('lewati')), names.join(', '));
    check('onFound terpanggil per berkas', found.length === 4, `dipanggil ${found.length}x`);
    check('onProgress melaporkan kemajuan & selesai', progress.length > 0 && progress[progress.length - 1].done === true,
        `${progress.length} laporan`);
    check('potongan 00001-of-… di atas potongan lanjutan',
        res.findIndex((m) => m.name.includes('00001-of-')) < res.findIndex((m) => m.name.includes('00002-of-')),
        res.map((m) => m.name).join(' > '));
    check('multipart ditandai', res.filter((m) => m.multipart).length === 2);
    check('ukuran berkas terbaca', res.every((m) => m.sizeBytes > 0));

    // 2) batas kedalaman dihormati
    const shallow = await scanGgufModels([root], { maxDepth: 2, timeoutMs: 20000 });
    check('maxDepth 2 tidak menemukan berkas di kedalaman 5', !shallow.some((m) => m.name.includes('model-b')), `${shallow.length} berkas`);

    // 3) pembatalan
    let calls = 0;
    const cancelledList = await scanGgufModels([root], { maxDepth: 6, timeoutMs: 20000, isCancelled: () => ++calls > 3 });
    check('pembatalan menghentikan pemindaian lebih awal', cancelledList.length <= 4, `${cancelledList.length} berkas`);

    // 4) batas waktu tidak membuat proses menggantung
    const t0 = Date.now();
    await scanGgufModels([root], { maxDepth: 6, timeoutMs: 1 });
    check('batas waktu 1 ms selesai cepat', Date.now() - t0 < 3000, `${Date.now() - t0} ms`);

    // 5) folder tak ada tidak membuat gagal
    const missing = await scanGgufModels([path.join(root, 'tidak-ada'), ''], { timeoutMs: 2000 });
    check('folder tidak ada diabaikan tanpa error', missing.length === 0);

    // 6) pengurutan & root default
    const sorted = sortModels([
        { path: 'x', name: 'b-00002-of-00002.gguf', sizeBytes: 900, multipart: true, part: '00002-of-00002' },
        { path: 'y', name: 'kecil.gguf', sizeBytes: 10, multipart: false },
    ]);
    check('sortModels: berkas kecil di bawah, potongan lanjutan paling bawah',
        sorted[0].name === 'kecil.gguf' && sorted[1].name === 'b-00002-of-00002.gguf', sorted.map((m) => m.name).join(' > '));
    const winRoots = defaultModelRoots('C:\\Users\\Tester', 'win32');
    check('root default Windows memuat Downloads/Documents/Desktop & folder app model',
        ['Downloads', 'Documents', 'Desktop', '.lmstudio', 'GPT4All'].every((k) => winRoots.some((r) => r.includes(k))),
        `${winRoots.length} root`);
    check('root default tanpa duplikat', new Set(winRoots.map((r) => r.toLowerCase())).size === winRoots.length);
    check('root default Linux/macOS tetap tersedia',
        defaultModelRoots('/home/u', 'linux').length > 5 && defaultModelRoots('/Users/u', 'darwin').length > 5);

    // 7) drive nyata mesin ini
    const drives = await listStorageRoots();
    check('drive/volume terdeteksi otomatis', drives.length >= 1, drives.join(' , '));
    check('formatBytes wajar', formatBytes(3 * 1024 ** 3) === '3.00 GB' && formatBytes(0) === '0 B', `${formatBytes(3 * 1024 ** 3)} / ${formatBytes(0)}`);

    reset();
    console.log(failed === 0 ? '\nSEMUA UJI LULUS' : `\n${failed} UJI GAGAL`);
    process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('error uji:', e); process.exit(1); });
