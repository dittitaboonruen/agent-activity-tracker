"""QA synthetic Legacy PDF pages only; no restricted AIA factors or customer data."""
import json
import os
import sys
from pathlib import Path
import fitz

if len(sys.argv) != 2:
    raise SystemExit("usage: legacy_pdf_a4_verify.py <downloaded.pdf>")

source = Path(sys.argv[1])
out = Path("artifacts/legacy-pdf-a4-qa")
out.mkdir(parents=True, exist_ok=True)
doc = fitz.open(source)
assert len(doc) >= 4, f"Expected at least four PDF pages, got {len(doc)}"
summary = []
for index, page in enumerate(doc):
    n = index + 1
    rect = page.rect
    assert abs(rect.width - 595.28) < 3 and abs(rect.height - 841.89) < 3, (
        f"page {n}: non-A4 page size {rect.width:.1f}x{rect.height:.1f}"
    )
    assert rect.height > rect.width, f"page {n}: not portrait"
    # Render every page and preserve PNG evidence for human visual inspection.
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), colorspace=fitz.csRGB, alpha=False)
    pix.save(str(out / f"page-{n:02d}.png"))
    data = pix.samples
    nonwhite = sum(1 for i in range(0, len(data), 3)
                   if min(data[i], data[i+1], data[i+2]) < 245)
    coverage = nonwhite / (pix.width * pix.height)
    assert coverage > 0.005, f"page {n}: nearly blank ({coverage:.3%})"

    # This only checks vector/text spans when available. A raster-only PDF
    # requires visual inspection; image coordinates do not prove no clipping.
    word_count = 0
    out_of_bounds_words = 0
    for x0, y0, x1, y1, word, *_ in page.get_text("words"):
        word_count += 1
        if x0 < -1 or y0 < -1 or x1 > rect.width+1 or y1 > rect.height+1:
            out_of_bounds_words += 1
    assert not out_of_bounds_words, f"page {n}: {out_of_bounds_words} words outside A4"
    summary.append({"page":n, "width_pt":round(rect.width,2),
       "height_pt":round(rect.height,2), "nonwhite_percent":round(coverage*100,2),
       "selectable_word_count":word_count,
       "human_visual_check_required":True})
    print(f"PDF QA: page {n}/{len(doc)} A4; coverage={coverage:.1%}; "
          f"selectable_words={word_count}; human visual review pending")

(out / "qa-metrics.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
print(f"PASS: all {len(doc)} PDF A4 pages render, are nonblank, "
      "and have no text geometry out of bounds (where selectable)")
print("NOTE: The PNGs require human review for typography, table overlap, and clipping.")
