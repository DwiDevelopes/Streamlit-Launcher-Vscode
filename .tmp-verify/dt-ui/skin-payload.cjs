/* Berkas sementara (bukan bagian produk): uji kontrak payload skin yang dipakai tombol
   “🎨 Bagikan Skin” — dibangkitkan src/petSkins.ts, dikonsumsi media/community.js.

   Menjalankan: node .tmp-verify/dt-ui/skin-payload.cjs
*/
const fs = require('fs');
const path = require('path');
const Module = require('module');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..', '..');
const outfile = path.join(__dirname, 'petSkins.bundle.cjs');
esbuild.buildSync({
    entryPoints: [path.join(root, 'src', 'petSkins.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    logLevel: 'silent',
    external: ['vscode'],
});

// `vscode` hanya tersedia di extension host: ganti dengan stub minimal untuk pengujian Node.
const asli = Module._load;
Module._load = function (request) {
    if (request === 'vscode') {
        return { workspace: { getConfiguration: () => ({ get: () => undefined }) } };
    }
    return asli.apply(this, arguments);
};

const { PET_SKINS, petSkinSharePayload } = require(outfile);

let fail = 0;
function ok(cond, label, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${extra ? ' (' + extra + ')' : ''}`);
    if (!cond) { fail += 1; }
}

console.log(`=== Payload skin (${PET_SKINS.length} kostum) ===`);
let semuaSah = true;
PET_SKINS.forEach((skin) => {
    const p = petSkinSharePayload(skin);
    let isi = null;
    try { isi = JSON.parse(String(p.data)); } catch (e) { isi = null; }
    const sah = typeof p.label === 'string' && p.label.length > 0
        && p.skinId === skin.id
        && typeof p.data === 'string' && !!(isi && isi.id === skin.id && typeof isi.accessorySvg === 'string');
    if (!sah) { semuaSah = false; console.log(`  gagal pada kostum ${skin.id}`); }
});
ok(semuaSah, 'setiap kostum menghasilkan payload sah (label + skinId + data JSON berisi aksesori)');

const contoh = petSkinSharePayload(PET_SKINS[0]);
console.log(`contoh: label="${contoh.label}" skinId=${contoh.skinId} aksesori=${contoh.accessory} panjang data=${String(contoh.data).length}`);
ok(contoh.label === (PET_SKINS[0].name || PET_SKINS[0].id), 'label memakai nama kostum');
ok(contoh.colors === PET_SKINS[0].colors, 'warna kostum ikut dikirim');
ok(Object.keys(contoh).length === 5, 'payload ringkas (5 kunci)', Object.keys(contoh).join(','));

console.log(`\n=== Ringkasan: ${fail} pemeriksaan gagal ===`);
process.exit(fail ? 1 : 0);
