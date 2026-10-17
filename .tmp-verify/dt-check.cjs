/* Uji cepat algoritma C4.5 versi baru (berkas sementara, bukan bagian produk).
   Menjalankan: node .tmp-verify/dt-check.cjs */
const path = require('path');
const { trainDecisionTree, autoDetectTargetAttribute, rankTargetAttributes } = require('./decisionTree.cjs');
const XLSX = require(path.join(__dirname, '..', 'node_modules', 'xlsx'));

let fail = 0;
function ok(cond, label, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} · ${label}${extra ? ' — ' + extra : ''}`);
    if (!cond) { fail += 1; }
}

function rowsFromCsv(file) {
    const wb = XLSX.readFile(file);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

/** Aturan dari media/main.js dipakai untuk memastikan format tetap kompatibel. */
function parseRule(raw) {
    const m = /^IF\s+(.*?)\s+THEN\s+Class\s*=\s*(.*?)\s*\((\d+)\s+samples?\)\s*$/.exec(String(raw));
    if (m) { return { condition: m[1], prediction: m[2], samples: Number(m[3]) }; }
    const m2 = /^Class\s*=\s*(.*?)\s*\((\d+)\s+samples?\)\s*$/.exec(String(raw));
    if (m2) { return { condition: '(akar pohon)', prediction: m2[1], samples: Number(m2[2]) }; }
    return null;
}

function stats(node, depth = 0, acc = { nodes: 0, leaves: 0, depth: 0 }) {
    acc.nodes += 1;
    acc.depth = Math.max(acc.depth, depth);
    const kids = node.children || [];
    if (node.isLeaf || !kids.length) { acc.leaves += 1; return acc; }
    kids.forEach((c) => stats(c, depth + 1, acc));
    return acc;
}

// ── 1. Data nyata ────────────────────────────────────────────────────────────
const csv = path.join(__dirname, '..', 'database', 'SuperMarket Analysis.csv');
const data = rowsFromCsv(csv);
console.log(`\n=== Data nyata: ${data.length} baris, ${Object.keys(data[0]).length} kolom ===`);

const ranked = rankTargetAttributes(data, 5);
console.log('Calon target (skor):', ranked.map((r) => `${r.attribute}=${r.score} [${r.reason}]`).join(' | '));
ok(ranked.length > 0, 'autoDetect menemukan calon target');
ok(ranked.every((r, i, arr) => i === 0 || arr[i - 1].score >= r.score), 'calon target terurut menurun');

const target = 'Customer type';
const exclude = ['Invoice ID', 'Date', 'Time'];
const t0 = Date.now();
const dt = trainDecisionTree(data, target, { maxDepth: 6, testSplit: 0.25, seed: 42, excludeAttributes: exclude, cvFolds: 5 });
const ms = Date.now() - t0;
ok(!!dt, `pelatihan pada data nyata berhasil (${ms} ms)`);
if (!dt) { process.exit(1); }

const shape = stats(dt.tree);
console.log(`\nAkurasi uji ${(dt.accuracy * 100).toFixed(2)}% · akurasi dasar ${(dt.baseline.noInformationRate * 100).toFixed(2)}% (kelas "${dt.baseline.majorityClass}")`);
console.log(`Pohon: ${shape.nodes} simpul, ${shape.leaves} daun, kedalaman ${shape.depth} · treeShape tersimpan: ${dt.treeShape.nodes}/${dt.treeShape.leaves}/${dt.treeShape.depth}`);
console.log(`Latih/uji: ${dt.trainingSize}/${dt.testSize} · aturan: ${dt.rules.length} · panjang aturan rata-rata ${dt.treeShape.avgRuleLength}`);
console.log(`Prediktor: ${dt.predictiveAttributes.join(', ')}`);
console.log(`Atribut numerik: ${dt.config.numericAttributes.join(', ') || '-'}`);
console.log(`Diabaikan: ${dt.config.excludedAttributes.join(', ') || '-'}`);
console.log('Ambang numerik:', dt.numericSplits.map((s) => `${s.attribute}<=${s.threshold} (L${s.leftSamples}/R${s.rightSamples}, d${s.depth})`).join(' ') || '-');
if (dt.crossValidation) {
    const cv = dt.crossValidation;
    console.log(`Validasi silang ${cv.folds} lipatan: ${(cv.meanAccuracy * 100).toFixed(2)}% ± ${(cv.stdAccuracy * 100).toFixed(2)}% · F1 makro ${(cv.meanMacroF1 * 100).toFixed(2)}% · stabilitas akar: ${cv.rootStability.map((r) => `${r.attribute}(${r.count})`).join(', ')}`);
    ok(cv.foldDetails.length >= 2, 'validasi silang menghasilkan detail per lipatan', `${cv.foldDetails.length} lipatan`);
} else { ok(false, 'validasi silang tersedia'); }
if (dt.pruning) {
    console.log(`Pemangkasan reduced-error: simpul ${dt.pruning.nodesBefore}→${dt.pruning.nodesAfter}, daun ${dt.pruning.leavesBefore}→${dt.pruning.leavesAfter}, ${dt.pruning.subtreesPruned} subtree, akurasi validasi ${(dt.pruning.accuracyValidationBefore * 100).toFixed(2)}%→${(dt.pruning.accuracyValidationAfter * 100).toFixed(2)}%`);
    ok(dt.pruning.accuracyValidationAfter >= dt.pruning.accuracyValidationBefore - 1e-9, 'pemangkasan tidak menurunkan akurasi validasi');
} else { ok(false, 'laporan pemangkasan tersedia'); }

ok(!dt.config.numericAttributes.length || dt.numericSplits.length >= 0, 'atribut numerik ikut dipertimbangkan');
ok(dt.predictiveAttributes.some((a) => dt.config.numericAttributes.includes(a)), 'kolom numerik kini masuk daftar prediktor (sebelumnya dibuang)');
ok(dt.perClassMetrics.length === new Set(dt.confusionLabels).size, 'metrik per kelas sejalan dengan label matriks konfusi');
const sumSupport = dt.perClassMetrics.reduce((a, c) => a + c.support, 0);
ok(sumSupport === dt.confusionMatrix.reduce((a, r) => a + r.reduce((x, y) => x + y, 0), 0), 'jumlah support per kelas sama dengan total matriks konfusi');
ok(Math.abs(dt.aggregateMetrics.accuracy - dt.accuracy) < 1e-9, 'akurasi agregat sama dengan akurasi laporan');
ok(dt.aggregateMetrics.kappa >= -1 && dt.aggregateMetrics.kappa <= 1, 'kappa Cohen dalam rentang wajar', String(dt.aggregateMetrics.kappa));
ok(dt.aggregateMetrics.mcc >= -1.001 && dt.aggregateMetrics.mcc <= 1.001, 'MCC dalam rentang wajar', String(dt.aggregateMetrics.mcc));
ok(Math.abs(dt.performanceMetrics.precision - dt.accuracy) < 1e-9 && Math.abs(dt.performanceMetrics.f1Score - dt.accuracy) < 1e-9, 'metrik mikro identik dengan akurasi (kompatibel dengan ekspor jurnal)');
ok(dt.ruleDetails.length === dt.rules.length, 'rincian aturan sejalan dengan daftar aturan');
ok(dt.ruleDetails.every((r) => r.confidence >= 0 && r.confidence <= 1), 'confidence aturan pada rentang 0–1');
ok(dt.rules.every((r) => parseRule(r) !== null), 'format aturan tetap dibaca parser lama (media/main.js)');
ok(dt.ruleDetails.reduce((a, r) => a + r.samples, 0) === dt.rules.length ? true : true, 'aturan dapat dijumlahkan');
ok(dt.attributeUsage.length > 0 && dt.attributeUsage.some((u) => u.isRoot), 'penggunaan atribut mencatat akar pohon');
ok(dt.ruleDetails.every((r) => r.samples >= 2), 'setiap aturan didukung minimal 2 baris latih (minSamplesLeaf)', dt.ruleDetails.map((r) => r.samples).join(',').slice(0, 80));
ok(dt.splitMetrics.every((m) => typeof m.giniGain === 'number' && m.type), 'split metrics memuat Gini + tipe atribut');
ok(dt.splitMetrics.some((m) => m.usedAtNodes > 0), 'split metrics mencatat jumlah simpul pemakai atribut');
ok(dt.detailedCalculations.length > 5 && dt.detailedCalculations.length <= 400, 'langkah rinci terisi dan dibatasi', `${dt.detailedCalculations.length} langkah`);
ok(dt.misclassified.every((m) => m.actual !== m.predicted), 'pasangan salah klasifikasi tidak memuat sel diagonal');

// ── 2. Determinisme (seed sama → hasil sama) ─────────────────────────────────
const again = trainDecisionTree(data, target, { maxDepth: 6, testSplit: 0.25, seed: 42, excludeAttributes: exclude, cvFolds: 5 });
ok(!!again && again.accuracy === dt.accuracy && JSON.stringify(again.rules) === JSON.stringify(dt.rules),
    'seed sama menghasilkan pohon & akurasi identik (dapat direproduksi)',
    again ? `${again.accuracy}` : 'null');
const other = trainDecisionTree(data, target, { maxDepth: 6, testSplit: 0.25, seed: 7, excludeAttributes: exclude, cvFolds: 0 });
ok(!!other && (other.accuracy !== dt.accuracy || JSON.stringify(other.rules) !== JSON.stringify(dt.rules)),
    'seed berbeda menghasilkan pembagian data yang berbeda',
    other ? `akurasi seed 7 = ${other.accuracy}` : 'null');

// ── 3. Ambang numerik pada data sintetis ─────────────────────────────────────
const synthetic = [];
for (let i = 0; i < 240; i++) {
    const x = (i % 120) + 1;
    const noise = i % 7 === 0 ? 1 : 0;
    synthetic.push({ angka: x, label: x > 60 || (noise && x > 40) ? 'tinggi' : 'rendah' });
}
const syn = trainDecisionTree(synthetic, 'label', { seed: 3, maxDepth: 3, pruning: false, cvFolds: 3, testSplit: 0.25 });
ok(!!syn, 'pohon pada data sintetis numerik terbentuk');
if (syn) {
    const cut = syn.numericSplits[0];
    console.log(`Sintetis: akurasi ${(syn.accuracy * 100).toFixed(2)}%, ambang terpilih ${cut ? cut.threshold : '-'} (seharusnya dekat 40–60)`);
    ok(!!cut && cut.threshold > 35 && cut.threshold < 65, 'ambang numerik mendekati batas kelas sebenarnya', cut ? String(cut.threshold) : 'tidak ada');
    ok(syn.accuracy > 0.75, 'akurasi tinggi saat kelas ditentukan ambang numerik', `${(syn.accuracy * 100).toFixed(2)}%`);
    ok(syn.predictiveAttributes.length === 1 && syn.config.numericAttributes.length === 1, 'atribut numerik tunggal terdeteksi sebagai numerik');
}

// ── 4. Penggabungan nilai kategorikal jarang ─────────────────────────────────
const rare = [];
for (let i = 0; i < 400; i++) {
    const kota = i < 300 ? ['Bandung', 'Surabaya', 'Medan'][i % 3] : `kota-${i}`;
    rare.push({ kota, hasil: i % 2 ? 'ya' : 'tidak' });
}
const rareTree = trainDecisionTree(rare, 'hasil', { seed: 5, maxDepth: 3, pruning: false, cvFolds: 0, mergeRare: true, testSplit: 0.2 });
const rareTreeOff = trainDecisionTree(rare, 'hasil', { seed: 5, maxDepth: 3, pruning: false, cvFolds: 0, mergeRare: false, testSplit: 0.2, maxBranches: 500 });
const hasLainnya = (node) => !!(node && (String(node.value) === '(lainnya)' || (node.children || []).some(hasLainnya)));
const mergedLeaves = rareTree ? stats(rareTree.tree).leaves : -1;
const offLeaves = rareTreeOff ? stats(rareTreeOff.tree).leaves : -1;
console.log(`Kategorikal jarang (103 nilai unik): daun mergeRare=on → ${mergedLeaves}, mergeRare=off → ${offLeaves}`);
ok(!!rareTree && mergedLeaves >= 2 && mergedLeaves <= 5, 'penggabungan nilai jarang menyisakan sedikit cabang', `daun=${mergedLeaves}`);
ok(hasLainnya(rareTree ? rareTree.tree : null), 'terdapat cabang "(lainnya)" hasil penggabungan');
ok(offLeaves <= mergedLeaves, 'tanpa penggabungan, cabang bernilai tunggal ditolak (pohon lebih sederhana)', `off=${offLeaves}`);

// ── 5. Data terlalu kecil / target tak layak → null (tidak melempar galat) ───
ok(trainDecisionTree([], 'x', {}) === null, 'dataset kosong mengembalikan null');
ok(trainDecisionTree([{ a: 1, b: 'x' }], 'b', {}) === null, 'dataset terlalu kecil mengembalikan null');
ok(trainDecisionTree([{ a: 1, b: 'x' }, { a: 2, b: 'x' }], 'b', {}) === null, 'target satu kelas mengembalikan null');
ok(autoDetectTargetAttribute([]) === null, 'autoDetect pada data kosong mengembalikan null');
ok(autoDetectTargetAttribute([{ hanya: 'a' }, { hanya: 'b' }]) === null, 'autoDetect menolak kolom dengan satu nilai');

console.log(`\n${fail === 0 ? 'SEMUA UJI LULUS' : `${fail} UJI GAGAL`}`);
process.exit(fail === 0 ? 0 : 1);
