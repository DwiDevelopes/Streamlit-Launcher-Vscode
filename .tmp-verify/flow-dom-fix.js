/* Ubah badan uji di flow-dom-check.js menjadi async (scratch, sekali pakai). */
const fs = require('fs');
const p = __dirname + '/flow-dom-check.js';
let s = fs.readFileSync(p, 'utf8');
const sebelum = (s.match(/cek\('/g) || []).length;
s = s.replace(/cek\((\s*'[^']*'\s*),\s*\(\)\s*=>\s*\{/g, 'cek($1, async () => {');
const sesudah = (s.match(/cek\((\s*'[^']*'\s*),\s*async\s*\(\)\s*=>\s*\{/g) || []).length;
fs.writeFileSync(p, s, 'utf8');
console.log(`kasus: ${sebelum}, jadi async: ${sesudah}`);
