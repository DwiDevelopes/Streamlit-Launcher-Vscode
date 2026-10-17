/* Berkas sementara (bukan bagian produk): bangun modul TS yang dibutuhkan harness di .tmp-verify/out.
   Mode transpilasi per-berkas (tanpa bundel) sama seperti berkas lama di folder out.
   Menjalankan: node .tmp-verify/dt-ui/build-out.cjs
*/
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..', '..');
const daftar = ['spider', 'llamaCore', 'analysisStore', 'decisionTree', 'kpi', 'workflow', 'analysis'];

for (const nama of daftar) {
    esbuild.buildSync({
        entryPoints: [path.join(root, 'src', `${nama}.ts`)],
        outfile: path.join(root, '.tmp-verify', 'out', `${nama}.js`),
        bundle: false,
        platform: 'node',
        format: 'cjs',
        logLevel: 'warning',
    });
}
console.log(`dibangun ${daftar.length} modul ke .tmp-verify/out`);
