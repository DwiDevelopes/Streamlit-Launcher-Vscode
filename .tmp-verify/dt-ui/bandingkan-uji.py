"""Berkas sementara: bandingkan keluaran uji algoritma C4.5 sebelum vs sesudah perbaikan tipe.

Tee-Object PowerShell 5.1 menulis UTF-16, jadi berkas dibaca sesuai BOM; hanya baris hasil uji
(PASS/FAIL/SEMUA) yang dibandingkan, angka waktu diabaikan, dan baris diagnostik stderr dibuang.
"""
import re

def muat(path):
    raw = open(path, 'rb').read()
    enc = 'utf-16' if raw[:2] in (b'\xff\xfe', b'\xfe\xff') else 'utf-8'
    teks = raw.decode(enc, errors='replace')
    hasil = []
    for baris in teks.splitlines():
        baris = baris.strip()
        if not baris:
            continue
        if baris.startswith(('PASS', 'FAIL', 'SEMUA', 'OK')):
            hasil.append(re.sub(r'\(\d+ ms\)', '(xx ms)', baris))
    return hasil

a = muat('.tmp-verify/dt-ui/baseline-dt-check.txt')
b = muat('.tmp-verify/dt-ui/after-dt-check.txt')
print('baris uji sebelum :', len(a))
print('baris uji sesudah :', len(b))
beda = [(i, x, y) for i, (x, y) in enumerate(zip(a, b), 1) if x != y]
print('baris berbeda     :', len(beda))
for i, x, y in beda[:12]:
    print(f'  {i:3}  sebelum: {x[:78]}')
    print(f'       sesudah: {y[:78]}')
print('gagal sebelum     :', sum(1 for x in a if x.startswith('FAIL')))
print('gagal sesudah     :', sum(1 for x in b if x.startswith('FAIL')))
print('identik           :', 'YA' if (not beda and len(a) == len(b)) else 'TIDAK')
