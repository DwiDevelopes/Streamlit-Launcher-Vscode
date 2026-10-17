// Skrip sementara (bukan bagian dari ekstensi): cari baris dengan kurung tidak seimbang.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
let depth = 0, i = 0, line = 1, state = 'code';
const rows = [];
while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '\n') { line++; rows.push([line - 1, depth]); if (state === 'line') { state = 'code'; } i++; continue; }
    if (state === 'code') {
        if (c === '/' && n === '/') { state = 'line'; i += 2; continue; }
        if (c === '/' && n === '*') { state = 'block'; i += 2; continue; }
        if (c === "'" || c === '"' || c === '`') { state = c; i++; continue; }
        if (c === '{') depth++;
        if (c === '}') depth--;
    } else if (state === 'line') {
        if (c === '\\') { i += 2; continue; }
    } else if (state === 'block') {
        if (c === '*' && n === '/') { state = 'code'; i += 2; continue; }
    } else {
        if (c === '\\') { i += 2; continue; }
        if (c === state) { state = 'code'; }
    }
    i++;
}
const from = Number(process.argv[3] || 1), to = Number(process.argv[4] || rows.length);
for (const [ln, d] of rows) { if (ln >= from && ln <= to) { console.log(`${ln}\t${d}`); } }
console.log('final depth:', depth, '| lines:', rows.length);
