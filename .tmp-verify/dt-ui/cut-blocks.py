"""Berkas sementara (bukan bagian produk): potong dua blok besar di media/main.js.

Regio 1: panel "Kustomisasi Model C4.5" + seluruh pengkabelannya + empty-state lama.
Regio 2: panel "Simulator Prediksi Kustom".
Semua anchor diperiksa tepat satu kemunculan sebelum berkas ditulis.
"""
import sys

PATH = 'media/main.js'
src = open(PATH, encoding='utf-8', newline='').read()
before = len(src)

A1 = '        // ── 0. Panel Kustomisasi Model C4.5 (Costume Target, Prediktor & Hyperparameter) ──'
B1 = '        const shape = treeShape(dt.tree);'
A2 = '        // ── 1. Simulator & Uji Prediksi Kustom (Costume What-If Analysis) ────────'
B2 = '        // ── 2. KPI ringkas ───────────────────────────────────────────────────────'

for name, anchor in (('A1', A1), ('B1', B1), ('A2', A2), ('B2', B2)):
    n = src.count(anchor)
    if n != 1:
        sys.exit(f'ABORT: anchor {name} muncul {n} kali, harus 1')

NEW_REGION_1 = '''        // Model pohon dibangun otomatis dari kolom kategorikal paling layak (lihat src/analysis.ts).
        if (!dt) {
            const emptyCard = el('div', 'card wide');
            emptyCard.innerHTML = '<div class="muted" style="padding:16px 20px;line-height:1.6;">ℹ️ Pohon keputusan C4.5 belum terbentuk untuk lembar ini. Model dibangun otomatis dari kolom kategorikal yang paling layak dijadikan target, dan syaratnya minimal 2 kelas berbeda dengan sekurangnya 20 baris data valid. Periksa kolom kategori pada tabel <b>Column Details</b>, atau pakai lembar lain yang memiliki kolom kategori.</div>';
            body.appendChild(emptyCard);
            return;
        }

'''

start1 = src.index(A1)
end1 = src.index(B1)
start2 = src.index(A2)
end2 = src.index(B2)
if not (start1 < end1 < start2 < end2):
    sys.exit('ABORT: urutan anchor tidak sesuai dugaan')

print(f'Regio 1: baris {src.count(chr(10), 0, start1) + 1}–{src.count(chr(10), 0, end1)} ({end1 - start1} byte)')
print(f'Regio 2: baris {src.count(chr(10), 0, start2) + 1}–{src.count(chr(10), 0, end2)} ({end2 - start2} byte)')

# potong dari belakang agar indeks regio 1 tetap valid
src = src[:start2] + src[end2:]
src = src[:start1] + NEW_REGION_1 + src[end1:]

open(PATH, 'w', encoding='utf-8', newline='').write(src)
print(f'selesai: {before} → {len(src)} byte (Δ {len(src) - before})')
