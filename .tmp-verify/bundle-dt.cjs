/* Bundel src/decisionTree.ts untuk pengujian Node (berkas sementara). */
const esbuild = require('esbuild');
esbuild.buildSync({
    entryPoints: ['src/decisionTree.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: '.tmp-verify/decisionTree.cjs',
    logLevel: 'info',
});
console.log('bundled OK');
