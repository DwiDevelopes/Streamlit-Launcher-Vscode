# Panduan Patch: Perbaikan Export Excel + Export PPTX

File baru (taruh di `src/`): `excelSafe.ts`, `pptGenerator.ts`. File pengganti penuh: `exporter.ts`.
Instal dependensi: `npm i pptxgenjs`

## A. excelGenerator.ts (6 edit kecil)

1. Import (baris atas):
```ts
import { sanitizeWorkbook, findCircular, polishWorkbook, fillToc } from './excelSafe';
```

2. Buat lembar "Daftar Isi" PALING AWAL, tepat setelah `wb.calcProperties = ...;`:
```ts
const wsToc = wb.addWorksheet('Daftar Isi', { properties: { tabColor: { argb: 'FF1F3864' } } });
```

3. Lembar Decision Tree: caption grafik samping menimpa kolom matriks konfusi. Ganti
```ts
const SC = 10;
```
(yang di dalam blok `if (dt)`) menjadi:
```ts
const SC = Math.max(10, k + 3);
```

4. Lembar "Tren & Kelompok": hapus `ROW(range)` di dalam SLOPE/RSQ/FORECAST (Excel menganggapnya array implisit,
   hasil bisa salah). Ganti kolom bantu indeks. Ubah bagian awal `sheet.trends.forEach`:
```ts
hdr(wsT.addRow(['Periode', 'Rata-rata', 'Perubahan', 'Perubahan (%)', 'Indeks (t)']));
const f0 = wsT.rowCount + 1;
tr.labels.forEach((l, k) => { const r = f0 + k; wsT.addRow([l, tr.values[k], k ? F(`B${r}-B${r - 1}`) : null, k ? F(`IF(B${r - 1}=0,0,(B${r}-B${r - 1})/ABS(B${r - 1}))`) : null, k + 1]); });
const e = wsT.rowCount;
body(wsT, f0, e, 5);
```
   dan tiga rumus statistik menjadi:
```ts
stat('Kemiringan tren (SLOPE)', F(`SLOPE(B${f0}:B${e},E${f0}:E${e})`), R4);
stat('R2 tren (RSQ)', F(`RSQ(B${f0}:B${e},E${f0}:E${e})`), R3);
stat('Prakiraan periode berikutnya (FORECAST)', F(`FORECAST(E${e}+1,B${f0}:B${e},E${f0}:E${e})`));
```
   Tambahkan juga lebar kolom: `widths(wsT, [34, 16, 14, 18, 12]);`

5. Persediaan, rumus Gini: ganti `ROW(${col('E')})` agar tidak array implisit (aman di SUMPRODUCT, opsional) , biarkan bila tidak mau ubah.

6. Bagian paling akhir, ganti `return new Uint8Array(await wb.xlsx.writeBuffer());` dengan:
```ts
fillToc(wb, wsToc, fileName, {
    'Ringkasan': 'Skor kualitas data (rumus hidup), hasil pemeriksaan, catatan otomatis, rekomendasi',
    'Profil Kolom': 'Tipe, jumlah terisi/hilang, nilai unik, min/rata-rata/maks per kolom',
    'Data': 'Data sumber (dipakai semua rumus)',
    'Statistik': 'Statistik deskriptif, outlier IQR, interval kepercayaan, histogram',
    'Korelasi': 'Matriks korelasi Pearson (CORREL) + peta panas',
    'Regresi': 'Regresi linear sederhana 15 pasangan terkuat (a, b, R2, t, p)',
    'Kategorikal': 'Frekuensi kategori, entropi, uji chi-kuadrat dan V Cramer',
    'Tren & Kelompok': 'Tren waktu, prakiraan, perbandingan rata-rata antar kelompok',
    'Ringkasan Stok': 'Parameter stok, status, ABC, HHI, Gini, kategori',
    'Persediaan': 'Daftar item: nilai, % kumulatif, ABC, status, rekomendasi pesan',
    'Pengadaan': 'Daftar kebutuhan pengadaan, anggaran, risiko, rencana aksi',
    'Decision Tree': 'Entropi, gain ratio, kepentingan fitur, matriks konfusi, metrik',
    'DT Aturan': 'Seluruh aturan keputusan C4.5',
    'DT Langkah': 'Langkah perhitungan rinci entropi dan gain',
    'Workflow': 'Diagram alir analisis + tabel ringkasan',
    'Grafik': 'Galeri seluruh grafik',
    'Metodologi': 'Daftar rumus yang digunakan',
});
const rep = sanitizeWorkbook(wb);
const cyc = findCircular(wb);
if (cyc.length) { console.error('[Date Skunder] REFERENSI MELINGKAR terdeteksi:\n' + cyc.join('\n')); }
if (rep.clipped || rep.nonFinite || rep.badChars) { console.warn('[Date Skunder] sel dibersihkan:', rep); }
polishWorkbook(wb);
return new Uint8Array(await wb.xlsx.writeBuffer());
```

## B. decisionTree.ts: penyebab utama "We found a problem with some content"
Pada `findBestAttribute`, string `calcDetail` memuat SETIAP nilai unik atribut. Untuk kolom numerik (Sales, Tax, Total, ...)
panjangnya bisa > 32.767 karakter (batas satu sel Excel) -> Excel menganggap file rusak. Batasi 12 nilai:
```ts
let calcDetail = `Atribut "${attr}" memiliki ${subsets.size} nilai unik:\n`;
let shown = 0;
subsets.forEach((subset, value) => {
    if (shown++ >= 12) { return; }
    const subEntropy = calculateEntropy(subset, targetAttr);
    const weight = subset.length / data.length;
    calcDetail += `  - Value "${value}": ${subset.length} sampel (${(weight * 100).toFixed(1)}%), H = ${subEntropy.toFixed(4)}\n`;
});
if (subsets.size > 12) { calcDetail += `  ... dan ${subsets.size - 12} nilai lain\n`; }
```
(`sanitizeWorkbook` tetap memotong sel panjang sebagai jaring pengaman.)

Saran (opsional, hasil model lebih masuk akal): di `analysis.ts` tambahkan ke `excludeAttrs` kolom numerik desimal /
integer ber-unik banyak, karena C4.5 versi ini tidak melakukan diskretisasi ambang:
```ts
return col?.type === 'id' || col?.type === 'text' || col?.type === 'date'
    || col?.type === 'number' || (col?.type === 'integer' && col.unique > 30);
```

## C. extension.ts
```ts
// di handler pesan webview, tambahkan:
} else if (m.type === 'savePptx') {
    await exportReport('pptx', doc.uri, m.sheetName);
}
// ubah tipe:
const exportCmd = (format: 'docx' | 'pdf' | 'xlsx' | 'pptx' | 'workflow') => ...
// daftarkan perintah:
vscode.commands.registerCommand('date-skunder.exportPptx', exportCmd('pptx')),
```

## D. package.json (di dalam `contributes.commands`, dan menu bila ada)
```json
{ "command": "date-skunder.exportPptx", "title": "Date Skunder: Export Presentasi PowerPoint (PPTX)" }
```
Pastikan berada DI DALAM `contributes`.

## E. media/main.js (tombol di webview)
Tambahkan tombol di samping tombol Export PDF/Excel yang sudah ada dan kirim pesan yang sama polanya:
```js
vscode.postMessage({ type: 'savePptx', sheetName: currentSheetName });
```
(gunakan nama variabel sheet aktif yang sama seperti pada tombol `savePdf`).