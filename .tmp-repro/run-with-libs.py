"""Runner uji: jalankan skrip dengan tambahan path paket (untuk menguji matplotlib di folder .tmp-repro/pylibs)."""
import os
import runpy
import sys

libs = os.environ.get("SKUNDER_LIBS")
if libs:
    sys.path.insert(0, libs)
sys.argv = sys.argv[1:]
if not sys.argv:
    sys.argv = ["analysis.py"]
runpy.run_path(sys.argv[0], run_name="__main__")
