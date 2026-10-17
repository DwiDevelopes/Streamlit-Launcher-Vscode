#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dashboard interaktif (opsional) dari hasil export Date Skunder.

Jalankan:
  pip install -r requirements.txt
  streamlit run streamlit_app.py

Semua angka diambil dari data/ dan stats.json — tidak ada koneksi internet yang dibutuhkan.
"""

import json
import os

import pandas as pd
import streamlit as st

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
STATS_FILE = os.path.join(BASE_DIR, "stats.json")

st.set_page_config(page_title="Date Skunder — Analisis Data", page_icon="📊", layout="wide")
st.title("📊 Date Skunder — Dashboard Analisis")
st.caption("Dibuat otomatis dari ekstensi Streamlit Launcher (Date Skunder).")


@st.cache_data(show_spinner=False)
def baca_index():
    path = os.path.join(DATA_DIR, "index.json")
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as berkas:
        return json.load(berkas)


@st.cache_data(show_spinner=False)
def baca_stats():
    if not os.path.exists(STATS_FILE):
        return {}
    with open(STATS_FILE, "r", encoding="utf-8") as berkas:
        return json.load(berkas)


@st.cache_data(show_spinner=False)
def baca_data(nama_berkas):
    return pd.read_csv(os.path.join(DATA_DIR, nama_berkas))


index = baca_index()
stats = baca_stats()
if not index:
    st.error("Folder data/ kosong — jalankan analisis.py lebih dulu atau periksa isi paket export.")
    st.stop()

st.sidebar.header("Pilih data")
pilihan = st.sidebar.selectbox("Sheet", [str(x.get("sheet")) for x in index], index=0)
entri = next((x for x in index if str(x.get("sheet")) == pilihan), index[0])
lembar = next((x for x in (stats.get("sheets") or []) if str(x.get("name")) == pilihan), {})

df = baca_data(entri["file"])
st.subheader("Pratinjau data — " + pilihan)
st.write(str(len(df)) + " baris × " + str(len(df.columns)) + " kolom")
st.dataframe(df.head(500), use_container_width=True)

kualitas = lembar.get("csvHealth") or {}
if kualitas:
    kolom1, kolom2, kolom3, kolom4 = st.columns(4)
    kolom1.metric("Skor kualitas", str(kualitas.get("qualityScore")) + "/100", kualitas.get("qualityRating"))
    kolom2.metric("Kelengkapan", str(kualitas.get("completenessScore")) + "%")
    kolom3.metric("Integritas", str(kualitas.get("integrityScore")) + "%")
    kolom4.metric("Konsistensi", str(kualitas.get("consistencyScore")) + "%")

kpi = lembar.get("businessKpi") or {}
ringkas = kpi.get("summary") or {}
if ringkas:
    st.subheader("KPI bisnis")
    kolom = st.columns(4)
    kolom[0].metric("Pendapatan", format(ringkas.get("totalRevenue") or 0, ",.2f"))
    kolom[1].metric("Order", format(ringkas.get("totalOrders") or 0, ",.0f"))
    kolom[2].metric("Laba kotor", format(ringkas.get("grossProfit") or 0, ",.2f"))
    kolom[3].metric("Margin", format(ringkas.get("grossMarginPct") or 0, ",.2f") + "%")
    periode = (kpi.get("growth") or {}).get("periods") or []
    if periode:
        data_tren = pd.DataFrame(periode)
        st.line_chart(data_tren.set_index("period")["revenue"])
    produk = kpi.get("topProducts") or []
    if produk:
        st.bar_chart(pd.DataFrame(produk).set_index("label")["revenue"])

stok = lembar.get("stockAnalysis") or {}
if stok:
    st.subheader("Stok / inventaris")
    kpi_stok = stok.get("kpis") or {}
    kolom = st.columns(4)
    kolom[0].metric("Total SKU", format(kpi_stok.get("totalSKUs") or 0, ",.0f"))
    kolom[1].metric("Kritis", format(kpi_stok.get("criticalCount") or 0, ",.0f"))
    kolom[2].metric("Menipis", format(kpi_stok.get("lowCount") or 0, ",.0f"))
    kolom[3].metric("Valuasi", format(kpi_stok.get("totalValuation") or 0, ",.2f"))

angka = df.select_dtypes("number")
if not angka.empty:
    st.subheader("Jelajah kolom numerik")
    kolom_pilih = st.selectbox("Kolom numerik", list(angka.columns))
    st.bar_chart(angka[kolom_pilih].dropna().reset_index(drop=True).head(200))
    st.line_chart(angka[kolom_pilih].dropna().reset_index(drop=True).head(200))

with st.expander("Ringkasan statistik (pandas)"):
    st.dataframe(df.describe(include="all").transpose(), use_container_width=True)

st.caption("Data lengkap ada di folder data/ · laporan teks di laporan.txt (dari analysis.py).")
