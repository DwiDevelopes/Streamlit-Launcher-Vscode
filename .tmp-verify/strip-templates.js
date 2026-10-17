/* Hapus jalur template dari src/flowGraph.ts (scratch, sekali pakai):
   pengurai kode (scanStatements/graphFromCode), konversi analisis (graphFromAnalysis/tebakNode),
   pengurai perintah lokal (localOps), dan impor tipe Flowchart yang tidak lagi dipakai. */
const fs = require('fs');
const p = __dirname + '/../src/flowGraph.ts';
let s = fs.readFileSync(p, 'utf8');
const awal = s.indexOf('// \u2500\u2500 pengurai kode \u2192 flowchart');
const akhir = s.indexOf('/** Pesan untuk model saat mengubah graf');
if (awal < 0 || akhir < 0 || akhir <= awal) { console.error('anchor tidak ditemukan', awal, akhir); process.exit(1); }
const dibuang = s.slice(awal, akhir);
s = s.slice(0, awal) + s.slice(akhir);
s = s.replace("import type { Flowchart } from './workflow';\n\n", '');
s = s.replace("import type { Flowchart } from './workflow';\n", '');
fs.writeFileSync(p, s, 'utf8');
console.log('dibuang', dibuang.split('\n').length, 'baris; masih ada impor Flowchart:', /from '\.\/workflow'/.test(s));
