"""Shared helpers: text measuring (DejaVu Sans, wider than Times New Roman), wrapping, drawio XML writer."""

import html
from PIL import ImageFont

FONT = "Times New Roman"
FS = 12
LINE_H = 15
_F = {}


def _font(size: int, bold: bool = False, italic: bool = False):
    key = (size, bold, italic)
    if key not in _F:
        name = "DejaVuSans"
        if bold:
            name += "-Bold"
        _F[key] = ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/{name}.ttf", size)
    return _F[key]


def tw(text: str, size: int = FS, bold: bool = False, italic: bool = False) -> float:
    return _font(size, bold, italic).getlength(text) * 1.03 + 2


def wrap(text: str, maxw: float, size: int = FS, bold: bool = False, italic: bool = False) -> list[str]:
    out: list[str] = []
    for para in text.split("\n"):
        words = para.split(" ")
        cur = ""
        for w in words:
            cand = (cur + " " + w).strip()
            if cur and tw(cand, size, bold, italic) > maxw:
                out.append(cur)
                cur = w
            else:
                cur = cand
        out.append(cur)
    return out


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def lines_html(lines: list[str]) -> str:
    """HTML label (lines joined by <br>), escaped once more for the XML attribute."""
    return esc("<br>".join(esc(x) for x in lines))


class Doc:
    def __init__(self, name: str) -> None:
        self.name = name
        self.cells: list[str] = []
        self.n = 1
        self.maxx = 0.0
        self.maxy = 0.0

    def nid(self) -> str:
        self.n += 1
        return f"c{self.n}"

    def _ext(self, x, y, w, h):
        self.maxx = max(self.maxx, x + w)
        self.maxy = max(self.maxy, y + h)

    def vertex(self, x, y, w, h, value, style, parent="1", cid=None) -> str:
        cid = cid or self.nid()
        self.cells.append(
            f'<mxCell id="{cid}" value="{value}" style="{style}" vertex="1" parent="{parent}">'
            f'<mxGeometry x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" as="geometry"/></mxCell>'
        )
        if parent == "1":
            self._ext(x, y, w, h)
        return cid

    def edge(self, style, pts, value="", src=None, tgt=None, label_x=None, label_dy=0.0, sp=None, tp=None) -> str:
        """pts: list of waypoints; sp/tp: absolute source/target points (used when src/tgt are None)."""
        cid = self.nid()
        attrs = ""
        if src:
            attrs += f' source="{src}"'
        if tgt:
            attrs += f' target="{tgt}"'
        geo = '<mxGeometry relative="1" as="geometry"'
        if label_x is not None:
            geo += f' x="{label_x}" y="{label_dy}"'
        geo += ">"
        if sp:
            geo += f'<mxPoint x="{sp[0]:.1f}" y="{sp[1]:.1f}" as="sourcePoint"/>'
            self._ext(sp[0], sp[1], 0, 0)
        if tp:
            geo += f'<mxPoint x="{tp[0]:.1f}" y="{tp[1]:.1f}" as="targetPoint"/>'
            self._ext(tp[0], tp[1], 0, 0)
        if pts:
            geo += '<Array as="points">' + "".join(f'<mxPoint x="{x:.1f}" y="{y:.1f}"/>' for x, y in pts) + "</Array>"
            for x, y in pts:
                self._ext(x, y, 0, 0)
        geo += "</mxGeometry>"
        self.cells.append(f'<mxCell id="{cid}" value="{value}" style="{style}" edge="1" parent="1"{attrs}>{geo}</mxCell>')
        return cid

    def text(self, x, y, lines, *, align="center", italic=False, bold=False, size=FS, bg=True, valign="middle",
             pad=3, parent="1") -> str:
        w = max(tw(s, size, bold, italic) for s in lines) + 2 * pad
        h = len(lines) * LINE_H + 2
        if align == "center":
            x0 = x - w / 2
        elif align == "right":
            x0 = x - w
        else:
            x0 = x
        st = (
            f"text;html=1;whiteSpace=nowrap;align={align};verticalAlign={valign};spacing=0;spacingLeft={pad};"
            f"spacingRight={pad};fontFamily={FONT};fontSize={size};fontColor=#000000;"
            f"fontStyle={(1 if bold else 0) + (2 if italic else 0)};strokeColor=none;"
            + ("fillColor=#FFFFFF;" if bg else "fillColor=none;")
        )
        return self.vertex(x0, y, w, h, lines_html(lines), st, parent=parent)

    def save(self, path: str) -> None:
        W, H = int(self.maxx + 20), int(self.maxy + 20)
        xml = (
            f'<mxfile host="app.diagrams.net" agent="MASSO generator" version="24.0.0">'
            f'<diagram id="{self.name}" name="{self.name}"><mxGraphModel dx="{W}" dy="{H}" grid="1" gridSize="10" '
            f'guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="{W}" '
            f'pageHeight="{H}" background="#FFFFFF" math="0" shadow="0"><root><mxCell id="0"/>'
            f'<mxCell id="1" parent="0"/>' + "".join(self.cells) + "</root></mxGraphModel></diagram></mxfile>"
        )
        with open(path, "w", encoding="utf-8") as f:
            f.write(xml)
