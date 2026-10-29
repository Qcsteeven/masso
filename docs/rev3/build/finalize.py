"""Fill the static table of contents and «На N листах» from Word's pagination, then export the PDF.

Run under WSL with Microsoft Word installed on Windows:
    finalize.py <in.docx> <out.docx> <out.pdf>
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from doclib import find, open_doc, paragraphs, set_text

WIN_TMP = Path("/mnt/c/Users/LCATHA~1/AppData/Local/Temp/masso_docs")
WIN_TMP_W = r"C:\Users\LCATHA~1\AppData\Local\Temp\masso_docs"
PS1 = Path(__file__).with_name("word_pages.ps1")


def word_pages(docx: Path, pdf_name: str = "") -> dict[str, object]:
    WIN_TMP.mkdir(parents=True, exist_ok=True)
    shutil.copy(PS1, WIN_TMP / PS1.name)
    if docx.resolve() != (WIN_TMP / docx.name).resolve():
        shutil.copy(docx, WIN_TMP / docx.name)
    cmd = [
        "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", f"{WIN_TMP_W}\\{PS1.name}",
        "-Path", f"{WIN_TMP_W}\\{docx.name}",
    ]
    if pdf_name:
        cmd += ["-Pdf", f"{WIN_TMP_W}\\{pdf_name}"]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=600, check=True, cwd=WIN_TMP).stdout
    return json.loads(out.strip().splitlines()[-1])


def fill(docx: Path, pages: int, heads: list[int]) -> None:
    d = open_doc(docx)
    sheets = [p for p in paragraphs(d) if re.fullmatch(r"На \d+ листах", p.text.strip())]
    if len(sheets) != 1:
        raise LookupError("no «На N листах» line")
    set_text(sheets[0], f"На {pages} листах")
    toc_start = find(d, "Содержание")
    ps = paragraphs(d)
    i = [p._p for p in ps].index(toc_start._p) + 1
    for page in heads:
        p = ps[i]
        if "\t" not in p.text:
            raise ValueError(f"not a TOC line: {p.text!r}")
        p.runs[-1].text = f"\t{page}"
        i += 1
    d.save(str(docx))


def main(src: Path, out_docx: Path, out_pdf: Path) -> None:
    work = WIN_TMP / out_docx.name
    WIN_TMP.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, work)
    for _ in range(3):  # page numbers in the TOC can shift pagination once; repeat until stable
        info = word_pages(work)
        fill(work, int(info["pages"]), [int(x) for x in info["headings"]])  # type: ignore[union-attr]
        check = word_pages(work, out_pdf.name)
        if check == info:
            break
    shutil.copy(work, out_docx)
    shutil.copy(WIN_TMP / out_pdf.name, out_pdf)
    print(json.dumps(check))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
