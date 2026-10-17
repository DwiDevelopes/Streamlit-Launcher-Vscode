/* Berkas sementara (bukan bagian produk): uji kualitas balasan Chat AI.
   Memeriksa tidyModelReply (anti-duplikat, anti-pembuka basi, buang pantulan pertanyaan) dan
   buildSystemPrompt (pola pikir, aturan bentuk jawaban, sifat/persona bawaan maupun kustom).
   Menjalankan: node .tmp-verify/dt-ui/chat-reply.cjs
*/
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..', '..');const outfile = path.join(__dirname, 'analysisStore.bundle.cjs');
esbuild.buildSync({
    entryPoints: [path.join(root, 'src', 'analysisStore.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    logLevel: 'silent',
});

const { tidyModelReply, buildSystemPrompt, buildStatsContext, AI_PERSONAS, resolvePersona } = require(outfile);

let fail = 0;
function ok(cond, label, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${extra ? ' (' + extra + ')' : ''}`);
    if (!cond) { fail += 1; }
}

console.log('=== tidyModelReply: anti-duplikat & langsung ke poin ===');
const dobel = [
    'Pendapatan total 322.966,75 dengan margin 18,2%.',
    '',
    'Pendapatan total 322.966,75 dengan margin 18,2%.',
].join('\n');
ok((tidyModelReply(dobel).match(/Pendapatan total/g) || []).length === 1, 'paragraf kembar disisakan satu');

const ulang = 'Stok kritis ada 12 SKU. Stok kritis ada 12 SKU. Segera restock 3 SKU teratas.';
ok((tidyModelReply(ulang).match(/Stok kritis ada 12 SKU\./g) || []).length === 1, 'kalimat kembar berturut-turut dipangkas');
ok(tidyModelReply(ulang).includes('Segera restock 3 SKU teratas.'), 'kalimat unik tetap ada');

const gado = 'Kesimpulan: margin 18,2%.\n\nKesimpulan: margin 18,2%.\n\nSisa: aman.';
ok((tidyModelReply(gado).match(/Kesimpulan: margin/g) || []).length === 1, 'blok kembar tak bersebelahan dihapus');

const basi = 'Baik, berikut adalah ringkasannya.\nMargin 18,2%.';
ok(tidyModelReply(basi).trim().startsWith('ringkasannya') || tidyModelReply(basi).trim().startsWith('Margin'), 'pembuka basi dibuang', JSON.stringify(tidyModelReply(basi).slice(0, 40)));
ok(!/^Baik/i.test(tidyModelReply(basi)), 'balasan tidak lagi dimulai dengan “Baik”');

const penutup = 'Margin 18,2%.\n\nSemoga membantu!';
ok(!/semoga membantu/i.test(tidyModelReply(penutup)), 'penutup janji kosong dibuang');

const pantul = 'Berapa margin kita?\nMargin 18,2% dari pendapatan 322.966,75.';
ok(!/^Berapa margin kita\?$/m.test(tidyModelReply(pantul, 'Berapa margin kita?')), 'pertanyaan pengguna tidak dipantulkan');
ok(tidyModelReply(pantul, 'Berapa margin kita?').includes('18,2%'), 'isi jawaban tetap ada');

const normal = 'Ringkasan KPI\n\n- Pendapatan 322.966,75\n- Laba 58.780,20';
ok(tidyModelReply(normal) === normal, 'teks rapi tidak berubah');
ok(tidyModelReply('') === '' && tidyModelReply('   ') === '' && tidyModelReply(null) === '', 'input kosong aman');

console.log('\n=== buildSystemPrompt: pola pikir, bentuk jawaban, sifat ===');
const prompt = buildSystemPrompt('KONTEKS DATA:\n- pendapatan 100', 'gaya ringkas');
ok(/CARA BERPIKIR/.test(prompt), 'ada bagian cara berpikir');
ok(/JANGAN tulis langkah berpikirmu/.test(prompt), 'pola pikir disuruh diam-diam (tidak dicetak)');
ok(/ATURAN BENTUK JAWABAN/.test(prompt), 'ada aturan bentuk jawaban');
ok(/Langsung ke poin utama/.test(prompt), 'aturan langsung ke poin utama');
ok(/maksimal 6 baris/.test(prompt), 'ada batas panjang untuk pertanyaan sederhana');
ok(/ANTI-HALUSINASI/.test(prompt), 'aturan anti-halusinasi tetap ada');
ok(/tidak tersedia di konteks ini/.test(prompt), 'kewajiban mengaku bila data tidak ada');
ok(/tidak bisa menekan tombol/.test(prompt), 'peran chat-only tetap ditegaskan');
ok(/pet Spider/.test(prompt), 'permintaan aksi diarahkan ke pet Spider');
ok(/gaya ringkas/.test(prompt), 'preferensi pengguna ikut');
ok(prompt.includes('KONTEKS DATA:'), 'konteks data disertakan');
ok(!/Sifat yang sedang dipakai:.*undefined/i.test(prompt), 'tanpa sifat, tidak ada “undefined”');

const ringkas = buildSystemPrompt('KONTEKS', '', 'ringkas');
ok(/maksimal 4 baris/.test(ringkas), 'sifat “ringkas” mengubah instruksi', 'ringkas');
const tegas = buildSystemPrompt('KONTEKS', '', 'tegas');
ok(/Tegas dan langsung pada sasaran/.test(tegas), 'sifat “tegas” terpasang');
const kustom = buildSystemPrompt('KONTEKS', '', 'analitis', 'Selalu sebut dampak rupiah dan risikonya.');
ok(/dampak rupiah dan risikonya/.test(kustom), 'sifat kustom ditempel');
ok(/perhitungan singkat/.test(kustom), 'sifat bawaan tetap ada saat kustom diisi');
ok(buildSystemPrompt('KONTEKS', '', 'id-ngawur').includes('Tenang dan profesional'), 'id sifat tak dikenal → netral');
ok(AI_PERSONAS.length === 6 && resolvePersona('guru').id === 'guru', 'daftar sifat lengkap (6)');

console.log('\n=== buildSystemPrompt: jangkar pertanyaan ===');
const promptTanya = buildSystemPrompt('KONTEKS', '', 'netral', '', 'berapa margin laba kita?');
ok(/PERTANYAAN PENGGUNA SAAT INI/.test(promptTanya), 'pertanyaan pengguna dijadikan jangkar di prompt');
ok(/berapa margin laba kita\?/.test(promptTanya), 'teks pertanyaan ikut disertakan');
ok(/jangan melebar ke topik lain/.test(promptTanya), 'ada larangan melebar dari topik');
ok(!/PERTANYAAN PENGGUNA SAAT INI/.test(buildSystemPrompt('KONTEKS')), 'tanpa pertanyaan, tidak ada jangkar kosong');

console.log('\n=== buildStatsContext: konteks fokus ke pertanyaan ===');
const { analyzeWorkbook } = require(path.join(__dirname, 'analysis.bundle.cjs'));
const fs = require('fs');
const payload = analyzeWorkbook(new Uint8Array(fs.readFileSync(path.join(root, 'database', 'SuperMarket Analysis.csv'))), 'SuperMarket Analysis.csv');
const entry = { id: 'uji', label: 'uji', fileName: 'SuperMarket Analysis.csv', sheetNames: payload.sheets.map((s) => s.name), result: payload, updatedAt: Date.now() };

const konteksKpi = buildStatsContext(entry, undefined, 20000, 'berapa total pendapatan dan margin laba?');
const konteksTree = buildStatsContext(entry, undefined, 20000, 'bagaimana aturan pohon keputusan C4.5 dan akurasinya?');
const konteksSemua = buildStatsContext(entry, undefined, 20000);
ok(/KPI bisnis/.test(konteksKpi), 'pertanyaan KPI memuat bagian KPI', `${konteksKpi.length} char`);
ok(!/Decision Tree C4\.5/.test(konteksKpi), 'pertanyaan KPI TIDAK memuat bagian pohon keputusan (tidak melebar)');
ok(/Decision Tree C4\.5/.test(konteksTree), 'pertanyaan C4.5 memuat bagian pohon keputusan');
ok(!/KPI bisnis/.test(konteksTree), 'pertanyaan C4.5 tidak memuat bagian KPI yang tidak ditanyakan');
ok(konteksSemua.length >= konteksKpi.length && /Decision Tree C4\.5/.test(konteksSemua), 'tanpa pertanyaan, konteks tetap selengkap mungkin');
const konteksUmum = buildStatsContext(entry, undefined, 20000, 'tolong bantu saya memahami konteks perhitungannya');
ok(/KPI bisnis/.test(konteksUmum), 'pertanyaan tanpa kata kunci dikenali → blok KPI tetap disertakan');
ok(/Decision Tree C4\.5/.test(konteksUmum), 'pertanyaan tanpa kata kunci dikenali → blok pohon tetap disertakan');
ok(konteksUmum.length > 3000, 'konteks tidak kosong saat kata kunci tidak dikenali', `${konteksUmum.length} char`);

console.log(`\n=== Ringkasan: ${fail} pemeriksaan gagal ===`);
process.exit(fail ? 1 : 0);
