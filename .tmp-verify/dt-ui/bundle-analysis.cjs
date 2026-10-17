/* Berkas sementara: bundel src/analysis.ts untuk harness render DOM (bukan bagian produk). */
const path = require('path');
const esbuild = require('esbuild');

esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', '..', 'src', 'analysis.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(__dirname, 'analysis.bundle.cjs'),
    logLevel: 'info',
});
console.log('bundled OK');
