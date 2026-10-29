"""Helpers for editing the revision-2 docx in place, keeping its formatting (fonts, spacing, numbering).

Paragraphs are located by a unique text prefix; new paragraphs are deep copies of an existing one,
so list numbering, indents and run fonts carry over.
"""

from __future__ import annotations

import copy
import struct
from pathlib import Path

import docx
from docx.document import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

EMU_PER_CM = 360000
MAX_W = int(16.5 * EMU_PER_CM)  # text width 170 mm minus a margin
MAX_H = int(23.0 * EMU_PER_CM)  # leaves room for the caption on an A4 page


def open_doc(path: str | Path) -> Document:
    return docx.Document(str(path))


def paragraphs(doc: Document) -> list[Paragraph]:
    return list(doc.paragraphs)


def find(doc: Document, prefix: str, *, start: Paragraph | None = None) -> Paragraph:
    """The only body paragraph whose text starts with prefix (after start, if given)."""
    ps = paragraphs(doc)
    if start is not None:
        ps = ps[[p._p for p in ps].index(start._p) + 1 :]
    hits = [p for p in ps if p.text.strip().startswith(prefix)]
    if len(hits) != 1:
        raise LookupError(f"{len(hits)} paragraphs start with {prefix!r}")
    return hits[0]


def heading(doc: Document, prefix: str) -> Paragraph:
    hits = [p for p in paragraphs(doc) if p.style is not None and p.style.name.startswith("Heading") and p.text.startswith(prefix)]
    if len(hits) != 1:
        raise LookupError(f"{len(hits)} headings start with {prefix!r}")
    return hits[0]


def set_text(p: Paragraph, text: str) -> Paragraph:
    """Replace the text, keeping the first run's formatting; bold label runs ("1.1 Name:") are not touched."""
    runs = p.runs
    if not runs:
        p.add_run(text)
        return p
    runs[0].text = text
    for r in runs[1:]:
        r._r.getparent().remove(r._r)
    return p


def add_after(anchor: Paragraph, text: str, like: Paragraph | None = None) -> Paragraph:
    """Insert a copy of `like` (default: anchor) with new text right after anchor."""
    src = like if like is not None else anchor
    el = copy.deepcopy(src._p)
    for d in el.findall(".//" + qn("w:drawing")):
        d.getparent().getparent().remove(d.getparent())
    anchor._p.addnext(el)
    p = Paragraph(el, anchor._parent)
    set_text(p, text)
    return p


def add_many_after(anchor: Paragraph, texts: list[str], like: Paragraph | None = None) -> Paragraph:
    for t in texts:
        anchor = add_after(anchor, t, like)
    return anchor


def restart_numbering(doc: Document, ps: list[Paragraph]) -> None:
    """Give the paragraphs a new numbered list (same look as their current one) that starts at 1."""
    num_part = doc.part.numbering_part.element
    old = ps[0]._p.find(".//" + qn("w:numId")).get(qn("w:val"))
    src = next(n for n in num_part.findall(qn("w:num")) if n.get(qn("w:numId")) == old)
    new_id = str(max(int(n.get(qn("w:numId"))) for n in num_part.findall(qn("w:num"))) + 1)
    el = copy.deepcopy(src)
    el.set(qn("w:numId"), new_id)
    for o in el.findall(qn("w:lvlOverride")):
        el.remove(o)
    ov = el.makeelement(qn("w:lvlOverride"), {qn("w:ilvl"): "0"})
    ov.append(ov.makeelement(qn("w:startOverride"), {qn("w:val"): "1"}))
    el.append(ov)
    num_part.append(el)
    for p in ps:
        p._p.find(".//" + qn("w:numId")).set(qn("w:val"), new_id)


def remove(p: Paragraph) -> None:
    p._p.getparent().remove(p._p)


def tables(doc: Document) -> list[Table]:
    return list(doc.tables)


def _set_cell(cell, text: str) -> None:  # type: ignore[no-untyped-def]
    ps = cell.paragraphs
    lines = text.split("\n")
    set_text(ps[0], lines[0])
    for extra in ps[1:]:
        extra._p.getparent().remove(extra._p)
    prev = ps[0]
    for line in lines[1:]:
        prev = add_after(prev, line)


def set_rows(table: Table, rows: list[list[str]], *, header: int = 1) -> None:
    """Replace data rows: the first data row is the formatting template; header rows stay."""
    tmpl = copy.deepcopy(table.rows[header]._tr)
    for r in list(table.rows)[header:]:
        r._tr.getparent().remove(r._tr)
    for values in rows:
        tr = copy.deepcopy(tmpl)
        table._tbl.append(tr)
        row = table.rows[-1]
        cells = row.cells
        if len(cells) != len(values):
            raise ValueError(f"row has {len(cells)} cells, got {len(values)} values: {values[:1]}")
        for c, v in zip(cells, values, strict=True):
            _set_cell(c, v)


def set_row(table: Table, idx: int, values: list[str]) -> None:
    for c, v in zip(table.rows[idx].cells, values, strict=True):
        _set_cell(c, v)


# ---------- images ----------


def png_size(path: str | Path) -> tuple[int, int]:
    with open(path, "rb") as f:
        head = f.read(24)
    w, h = struct.unpack(">II", head[16:24])
    return w, h


def _extent(path: str | Path, max_w: int, max_h: int) -> tuple[int, int]:
    w, h = png_size(path)
    cx = max_w
    cy = int(cx * h / w)
    if cy > max_h:
        cy = max_h
        cx = int(cy * w / h)
    return cx, cy


def set_image(doc: Document, p: Paragraph, png: str | Path, title: str, *, max_h: int = MAX_H) -> None:
    """Point the paragraph's picture at a new PNG, resized to the text width."""
    rid, _ = doc.part.get_or_add_image(str(png))
    blip = p._p.find(".//" + qn("a:blip"))
    if blip is None:
        raise LookupError("paragraph has no picture")
    blip.set(qn("r:embed"), rid)
    cx, cy = _extent(png, MAX_W, max_h)
    for tag in ("wp:extent", "a:ext"):
        for e in p._p.iter(qn(tag)):
            e.set("cx", str(cx))
            e.set("cy", str(cy))
    for e in p._p.iter(qn("wp:docPr")):
        e.set("name", title)
        e.set("descr", title)
        e.set("title", title)


def add_figure_after(
    doc: Document, anchor: Paragraph, png: str | Path, caption: str, img_like: Paragraph, cap_like: Paragraph
) -> Paragraph:
    """Insert picture + caption after anchor (copies of an existing figure pair); returns the caption."""
    el = copy.deepcopy(img_like._p)
    anchor._p.addnext(el)
    img_p = Paragraph(el, anchor._parent)
    set_image(doc, img_p, png, caption)
    _renumber_docpr(doc)
    return add_after(img_p, caption, cap_like)


def _renumber_docpr(doc: Document) -> None:
    for i, e in enumerate(doc.element.body.iter(qn("wp:docPr")), start=1):
        e.set("id", str(i))


class Templates:
    """Formatting samples taken from the source document before it is edited."""

    def __init__(self, body: Paragraph, img: Paragraph, cap: Paragraph, li: Paragraph, label: Paragraph):
        self.body = copy.deepcopy(body._p)
        self.img = copy.deepcopy(img._p)
        self.cap = copy.deepcopy(cap._p)
        self.li = copy.deepcopy(li._p)
        self.label = copy.deepcopy(label._p)


def _insert_copy(anchor_el, src_el, parent):  # type: ignore[no-untyped-def]
    el = copy.deepcopy(src_el)
    anchor_el.addnext(el)
    return Paragraph(el, parent)


def replace_between(doc: Document, start: Paragraph, stop: Paragraph | None, blocks: list[tuple], t: Templates) -> None:
    """Delete paragraphs strictly between start and stop (stop=None: up to the next Heading 1) and insert blocks.

    Blocks: ("p", text) body paragraph, ("li", text) bullet, ("label", text) bold run-in label,
    ("fig", png, caption) picture with caption.
    """
    body = doc.element.body
    el = start._p.getnext()
    while el is not None and el is not (stop._p if stop is not None else None):
        nxt = el.getnext()
        if el.tag == qn("w:tbl"):
            raise ValueError("a table lies inside the replaced range")
        if el.tag == qn("w:p"):
            p = Paragraph(el, start._parent)
            if stop is None and p.style is not None and p.style.name.startswith("Heading"):
                break
            body.remove(el)
        elif el.tag == qn("w:sectPr"):
            break
        el = nxt
    anchor = start._p
    for b in blocks:
        kind = b[0]
        if kind == "fig":
            ip = _insert_copy(anchor, t.img, start._parent)
            set_image(doc, ip, b[1], b[2])
            cp = _insert_copy(ip._p, t.cap, start._parent)
            set_text(cp, b[2])
            anchor = cp._p
        else:
            src = {"p": t.body, "li": t.li, "label": t.label}[kind]
            np_ = _insert_copy(anchor, src, start._parent)
            set_text(np_, b[1])
            anchor = np_._p
    _renumber_docpr(doc)


def drop_unused_images(doc: Document) -> None:
    """Remove image relationships no longer referenced (old pictures replaced by new PNGs)."""
    used = {b.get(qn("r:embed")) for b in doc.element.body.iter(qn("a:blip"))}
    rels = doc.part.rels
    for rid in [r for r, rel in rels.items() if "image" in rel.reltype and r not in used]:
        doc.part.drop_rel(rid)


# ---------- page orientation ----------

LAND_W = int(25.0 * EMU_PER_CM)
LAND_H = int(13.0 * EMU_PER_CM)


def _sect_break(p: Paragraph, body_sect, landscape: bool) -> None:  # type: ignore[no-untyped-def]
    """End the section at paragraph p with the given orientation (a copy of the document's page setup)."""
    sp = copy.deepcopy(body_sect)
    for t in sp.findall(qn("w:type")):
        sp.remove(t)
    ty = sp.makeelement(qn("w:type"), {qn("w:val"): "nextPage"})
    sp.insert(0, ty)
    pg = sp.find(qn("w:pgSz"))
    w, h = int(pg.get(qn("w:w"))), int(pg.get(qn("w:h")))
    if landscape:
        pg.set(qn("w:w"), str(max(w, h)))
        pg.set(qn("w:h"), str(min(w, h)))
        pg.set(qn("w:orient"), "landscape")
    else:
        pg.set(qn("w:w"), str(min(w, h)))
        pg.set(qn("w:h"), str(max(w, h)))
        if pg.get(qn("w:orient")) is not None:
            del pg.attrib[qn("w:orient")]
    # header/footer references are inherited from the previous section
    for ref in sp.findall(qn("w:headerReference")) + sp.findall(qn("w:footerReference")):
        sp.remove(ref)
    for pn in sp.findall(qn("w:pgNumType")):
        sp.remove(pn)
    ppr = p._p.get_or_add_pPr()
    old = ppr.find(qn("w:sectPr"))
    if old is not None:
        ppr.remove(old)
    ppr.append(sp)


def apply_orientation(doc: Document, landscape_sections: set[str]) -> int:
    """Put the Heading 1 sections whose number is in landscape_sections on landscape pages and enlarge their pictures."""
    body_sect = doc.element.body.find(qn("w:sectPr"))
    ps = paragraphs(doc)
    heads = [i for i, p in enumerate(ps) if p.style is not None and p.style.name.startswith("Heading 1")]
    num = lambda p: p.text.split(".")[0].strip()  # noqa: E731
    orient = []  # orientation of each heading's section
    for i in heads:
        orient.append(num(ps[i]) in landscape_sections)
    changed = 0
    prev = False  # front matter is portrait
    for k, i in enumerate(heads):
        cur = orient[k]
        if cur != prev:
            _sect_break(ps[i - 1], body_sect, prev)  # close the previous run with its orientation
            changed += 1
        prev = cur
        end = heads[k + 1] if k + 1 < len(heads) else len(ps)
        if cur:
            for p in ps[i:end]:
                for ext in p._p.iter(qn("wp:extent")):
                    cx, cy = int(ext.get("cx")), int(ext.get("cy"))
                    ncx = LAND_W
                    ncy = int(ncx * cy / cx)
                    if ncy > LAND_H:
                        ncy = LAND_H
                        ncx = int(ncy * cx / cy)
                    for e in list(p._p.iter(qn("wp:extent"))) + list(p._p.iter(qn("a:ext"))):
                        e.set("cx", str(ncx))
                        e.set("cy", str(ncy))
    if prev:  # last run landscape: make the final (body) section landscape too
        pg = body_sect.find(qn("w:pgSz"))
        w, h = int(pg.get(qn("w:w"))), int(pg.get(qn("w:h")))
        pg.set(qn("w:w"), str(max(w, h)))
        pg.set(qn("w:h"), str(min(w, h)))
        pg.set(qn("w:orient"), "landscape")
    return changed
