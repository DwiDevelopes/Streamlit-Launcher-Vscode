"""Berkas sementara: pastikan escape pada harness tepat (1 backslash untuk \n dan \. di dalam file JS)."""
BS = chr(92)
lines = open('.tmp-verify/dt-ui/render-dom.cjs', encoding='utf-8').read().split('\n')
for i, l in enumerate(lines, 1):
    if 'join(' in l or 'Analisis C4' in l or '=== Uji interaksi' in l or 'Ringkasan' in l:
        print(i, '|', repr(l))
