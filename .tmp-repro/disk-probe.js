// Skrip sementara (bukan bagian ekstensi): bukti pencarian .gguf di penyimpanan nyata mesin ini.
const { scanGgufModels, listStorageRoots, defaultModelRoots, formatBytes } = require('./llamaCore.cjs');

(async () => {
    const drives = await listStorageRoots();
    console.log('Drive/volume terdeteksi:', drives.join(' , ') || '(tidak ada)');

    const mulai = Date.now();
    let terakhir = null;
    const hasil = await scanGgufModels(drives, {
        maxDepth: 4,
        timeoutMs: 25000,
        concurrency: 8,
        onProgress: (p) => { terakhir = p; },
    });
    const p = terakhir || {};

    console.log(`Selesai dalam ${((Date.now() - mulai) / 1000).toFixed(1)} s — ${(p.dirs || 0).toLocaleString('id-ID')} folder, ${(p.entries || 0).toLocaleString('id-ID')} entri diperiksa`);
    console.log(`Batas waktu tercapai: ${p.timedOut ? 'ya' : 'tidak'}`);
    console.log(`Berkas .gguf ditemukan: ${hasil.length}`);
    for (const m of hasil.slice(0, 20)) { console.log(`  - ${m.name} (${formatBytes(m.sizeBytes)}) → ${m.path}`); }

    const umum = defaultModelRoots().filter((r) => require('fs').existsSync(r));
    console.log(`\nFolder umum yang ada di mesin ini (${umum.length}):`);
    for (const r of umum) { console.log(`  - ${r}`); }
})();
