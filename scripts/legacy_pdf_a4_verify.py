"""Private CI smoke verification of synthetic Legacy PDF pages; never emits page content."""
import sys
import fitz

if len(sys.argv) != 2:
    raise SystemExit("usage: legacy_pdf_a4_verify.py <downloaded.pdf>")

doc = fitz.open(sys.argv[1])
assert len(doc) >= 4, f"Expected at least four PDF pages, got {len(doc)}"
for idx, page in enumerate(doc):
    rect = page.rect
    # A4 portrait, allowing rendering/PDF point rounding.
    assert abs(rect.width - 595.28) < 3 and abs(rect.height - 841.89) < 3, (
        f"page {idx + 1}: non-A4 page size {rect.width:.1f}x{rect.height:.1f}"
    )
    pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5), colorspace=fitz.csRGB, alpha=False)
    data = pix.samples
    nonwhite = sum(
        1 for i in range(0, len(data), 3)
        if min(data[i], data[i + 1], data[i + 2]) < 245
    )
    coverage = nonwhite / (pix.width * pix.height)
    assert coverage > 0.005, f"page {idx + 1}: rendered PDF page nearly blank ({coverage:.3%})"
    print(f"PDF QA: page {idx + 1}/{len(doc)} A4 portrait, rendered coverage {coverage:.1%}")
print(f"PASS: rendered all {len(doc)} synthetic-data PDF A4 pages (nonblank and valid dimensions)")
