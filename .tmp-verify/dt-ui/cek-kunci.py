"""Berkas sementara: laporkan apakah src/community.ts memuat kunci literal (nilai tidak dicetak)."""
import re

PATH = 'src/community.ts'
teks = open(PATH, encoding='utf-8').read()
for i, baris in enumerate(teks.split('\n'), 1):
    if 'API_KEY' in baris or 'apiKey' in baris:
        m = re.match(r'^\s*(export const [A-Z_]+|[A-Za-z]+)\s*[=:]\s*(.+?)\s*[,;]?\s*$', baris)
        if not m:
            print(i, '| baris tidak cocok pola (nama kunci terdeteksi)')
            continue
        nama, nilai = m.group(1).strip(), m.group(2).strip()
        literal = (len(nilai) >= 2) and (nilai[0] in "'\"") and (nilai[-1] == nilai[0])
        print(f'{i} | {nama} | literal string: {literal} | panjang nilai: {len(nilai)} | diawali AIza: {nilai.startswith(chr(39) + "AIza") or nilai.startswith(chr(34) + "AIza")}')
