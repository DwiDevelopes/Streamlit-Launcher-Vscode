/* Debug tata letak (scratch): lihat lapis dan posisi tiap node dari contoh kode JS. */
const F = require('./out/flowGraph.js');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/flow-check.js', 'utf8');
const mulai = src.indexOf('const JS_CONTOH = `') + 'const JS_CONTOH = `'.length;
const selesai = src.indexOf('`;', mulai);
const JS = src.slice(mulai, selesai);

const g = F.graphFromCode(JS, 'js', 'Alur');
const peta = new Map(g.nodes.map((n) => [n.id, n]));
console.log('--- nodes ---');
g.nodes.forEach((n) => console.log(n.id.padEnd(4), String(n.x).padStart(5), String(n.y).padStart(4), n.kind.padEnd(9), n.title.slice(0, 44)));
console.log('--- edges ---');
g.edges.forEach((e) => {
    const a = peta.get(e.from), b = peta.get(e.to);
    console.log(e.id.padEnd(4), `${e.from} -> ${e.to}`.padEnd(12), 'x', String(a.x).padStart(5), '->', String(b.x).padStart(5), e.dashed ? '(dashed)' : '        ', e.label || '');
});
