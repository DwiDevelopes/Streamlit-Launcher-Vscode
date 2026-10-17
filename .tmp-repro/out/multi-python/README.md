# Paket Python — analisis `multi.xlsx`

Dibuat otomatis oleh ekstensi **Streamlit Launcher (Date Skunder)**. Seluruh data dianalisis ada di folder ini.

## Isi paket

- `data/penjualan.csv` — sheet **Penjualan** (40 baris)
- `data/stok-gudang.csv` — sheet **Stok Gudang** (40 baris)
- `data/index.json` — daftar sheet dan berkasnya
- `stats.json` — hasil analisis lengkap (KPI bisnis, stok, kebutuhan, kualitas CSV, decision tree, temuan otomatis)
- `analysis.py` — skrip utama (hanya pustaka bawaan Python)
- `streamlit_app.py` — dashboard interaktif opsional
- `requirements.txt` — paket opsional untuk grafik dan dashboard

## Cara menjalankan

1. Pastikan Python 3.8+ terpasang (`python --version`).
2. Jalankan skrip utama — tanpa pemasangan paket apa pun:

   ```
   python analysis.py
   ```

   Hasilnya: ringkasan di layar, berkas `laporan.txt`, dan (bila matplotlib terpasang) gambar di folder `grafik/`.

3. (Opsional) grafik statis:

   ```
   pip install matplotlib
   python analysis.py
   ```

4. (Opsional) dashboard interaktif:

   ```
   pip install -r requirements.txt
   streamlit run streamlit_app.py
   ```

## Pilihan lain

```
python analysis.py --no-chart      # tanpa grafik
python analysis.py --sheet Sheet1  # hanya satu sheet
```

## Catatan

- Angka pada `laporan.txt` dihitung ulang dari CSV di folder `data/`, jadi bisa dipakai memverifikasi hasil ekstensi.
- Bila berkas sumber sangat besar, analisis ekstensi memakai baris yang tersedia pada `stats.json`; CSV pada folder `data/` berisi data yang sama dengan yang dianalisis.
