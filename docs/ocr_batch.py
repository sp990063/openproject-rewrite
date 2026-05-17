#!/usr/bin/env python3
import subprocess, os, sys

OUT = '/home/cwlai/openproject-rewrite/docs/images-manual'
files = sorted([f for f in os.listdir(OUT) if f.endswith('.png')])

err_kw = ["404","Runtime Error","Project not found","Loading...","Failed to load",
          "This page could not be found","is not a function","TypeError"]

print(f"Total files: {len(files)}")

for i, fname in enumerate(files):
    fpath = os.path.join(OUT, fname)
    print(f"[{i+1}/{len(files)}] Processing {fname}...", end=" ", flush=True)

    # Build script content
    script = f"""
from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
result, _ = ocr({repr(fpath)})
if result is None:
    print("NO_TEXT")
else:
    text = " ".join([item[1] for item in result])
    has_err = any(k in text for k in {err_kw})
    label = "FAIL" if has_err else "PASS"
    print(label + ": " + text[:80])
"""

    r = subprocess.run(
        ['uv', 'run', '--with', 'rapidocr_onnxruntime', 'python3', '-c', script],
        capture_output=True, text=True, timeout=60
    )
    out = r.stdout.strip()
    if not out:
        out = "(no output)"
    print(out)