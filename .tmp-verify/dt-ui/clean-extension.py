"""Berkas sementara (bukan bagian produk): buang handler pelatihan pohon kustom dari src/extension.ts.

UI kustomisasi sudah dihapus dari webview, jadi cabang pesan 'trainCustomTree' dan metodenya
tidak lagi punya pemanggil.
"""
import sys

PATH = 'src/extension.ts'
src = open(PATH, encoding='utf-8', newline='').read()
before = len(src)

EDITS = [
    (
        "import { trainDecisionTree } from './decisionTree';\n",
        "",
    ),
    (
        "\t\t\t\t} else if (m.type === 'trainCustomTree') {\n"
        "\t\t\t\t\tawait this.trainCustomDecisionTree(panel, doc, m);\n"
        "\t\t\t\t} else if (m.type === 'shareAiToCommunity') {\n",
        "\t\t\t\t} else if (m.type === 'shareAiToCommunity') {\n",
    ),
]

for old, new in EDITS:
    n = src.count(old)
    if n != 1:
        sys.exit(f'ABORT: pola muncul {n} kali, harus 1: {old[:60]!r}')
    src = src.replace(old, new, 1)

A = ("\t/**\n"
     "\t * Pelatihan pohon keputusan C4.5 dengan atribut target dan parameter kustom dari pengguna.\n"
     "\t */\n"
     "\tprivate async trainCustomDecisionTree(")
B = "\tprivate getHtml(webview: vscode.Webview, media: vscode.Uri, icon: vscode.Uri, video: vscode.Uri): string {"

if src.count(A) != 1 or src.count(B) != 1:
    sys.exit('ABORT: anchor metode tidak unik')
i, j = src.index(A), src.index(B)
print(f'metode trainCustomDecisionTree: baris {src.count(chr(10), 0, i) + 1}–{src.count(chr(10), 0, j)} ({j - i} byte)')
src = src[:i] + src[j:]

open(PATH, 'w', encoding='utf-8', newline='').write(src)
print(f'selesai: {before} → {len(src)} byte (Δ {len(src) - before})')
