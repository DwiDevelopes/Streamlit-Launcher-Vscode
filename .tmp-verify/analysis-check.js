/* Uji fungsional scratch untuk perapian jawaban (tidyModelReply) + prompt Chat AI.
   Bundel src/analysisStore.ts dengan esbuild (cara yang sama seperti esbuild.js repo), lalu uji. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const esbuild = require('esbuild');

const outDir = path.join(__dirname, 'analysis-test');
fs.mkdirSync(outDir, { recursive: true });
const outfile = path.join(outDir, 'analysisStore.js');
esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', 'analysisStore.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    logLevel: 'silent',
});

const { tidyModelReply, buildSystemPrompt } = require(outfile);

// 1. Paragraf kembar (penyebab “jawaban dobel”) dibuang.
const dobel = [
    'Pendapatan total 322.966,75 dengan margin 18,2%.',
    '',
    'Pendapatan total 322.966,75 dengan margin 18,2%.',
].join('\n');
assert.strictEqual(
    tidyModelReply(dobel).match(/Pendapatan total/g).length,
    1,
    'paragraf kembar disisakan satu',
);

// 2. Kalimat kembar berturut-turut di dalam satu paragraf dipangkas.
const ulang = 'Stok kritis ada 12 SKU. Stok kritis ada 12 SKU. Segera restock 3 SKU teratas.';
const hasilUlang = tidyModelReply(ulang);
assert.strictEqual(hasilUlang.match(/Stok kritis ada 12 SKU\./g).length, 1, 'kalimat kembar dipangkas');
assert.ok(hasilUlang.includes('Segera restock 3 SKU teratas.'), 'kalimat unik tetap ada');

// 3. Teks normal tidak diubah isinya & baris berlebih dirapikan.
const normal = 'Ringkasan KPI\n\n- Pendapatan 322.966,75\n- Laba 58.780,20';
assert.strictEqual(tidyModelReply(normal), normal, 'teks rapi tidak berubah');

// 4. Aman untuk input kosong / aneh.
assert.strictEqual(tidyModelReply(''), '');
assert.strictEqual(tidyModelReply('   '), '');
assert.strictEqual(tidyModelReply(null), '');

// 5. Prompt chat memuat aturan anti-halusinasi + peran chat-only.
const prompt = buildSystemPrompt('KONTEKS DATA:\n- pendapatan 100', 'gaya ringkas');
assert.ok(/ANTI-HALUSINASI/.test(prompt), 'aturan anti-halusinasi ada');
assert.ok(/tidak tersedia di konteks ini/.test(prompt), 'kewajiban mengaku bila data tidak ada');
assert.ok(/tidak bisa menekan tombol/.test(prompt), 'peran chat-only ditegaskan');
assert.ok(/pet Spider/.test(prompt), 'permintaan aksi diarahkan ke pet');
assert.ok(/gaya ringkas/.test(prompt), 'preferensi pengguna ikut');

console.log('OK: tidyModelReply membuang duplikat & buildSystemPrompt memuat aturan anti-halusinasi.');
