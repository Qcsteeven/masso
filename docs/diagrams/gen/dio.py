"""Minimal draw.io writer with absolute coordinates and explicit polyline edges (monochrome style)."""

from xml.sax.saxutils import escape

FONT = "fontFamily=Times New Roman;fontColor=#000000;"
GRAY = "#F2F2F2"


def esc(s: str) -> str:
    return escape(s, {'"': "&quot;"})


class Diagram:
    def __init__(self, name: str):
        self.name = name
        self.cells: list[str] = []
        self.geo: dict[str, tuple[float, float, float, float]] = {}
        self.n = 0

    def _id(self, cid: str | None) -> str:
        if cid:
            return cid
        self.n += 1
        return f"x_{self.n}"

    def vertex(self, cid, x, y, w, h, value, style, parent="1"):
        cid = self._id(cid)
        self.geo[cid] = (x, y, w, h)
        self.cells.append(
            f'<mxCell id="{cid}" value="{esc(value)}" style="{style}" vertex="1" parent="{parent}">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
        )
        return cid

    # ---- shapes -------------------------------------------------------------------------------------------
    def box(self, cid, x, y, w, h, html, *, rounded=True, dashed=False, fill="#FFFFFF", size=12, stroke=1,
            align="center", valign="middle", spacing=4, extra=""):
        st = (f"rounded={1 if rounded else 0};arcSize={6 if rounded else 0};whiteSpace=wrap;html=1;strokeColor=#000000;"
              f"fillColor={fill};{FONT}fontSize={size};strokeWidth={stroke};align={align};verticalAlign={valign};"
              f"spacing={spacing};{'dashed=1;dashPattern=4 3;' if dashed else ''}{extra}")
        return self.vertex(cid, x, y, w, h, html, st)

    def cyl(self, cid, x, y, w, h, html, size=12):
        st = (f"shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=14;strokeColor=#000000;"
              f"fillColor=#FFFFFF;{FONT}fontSize={size};")
        return self.vertex(cid, x, y, w, h, html, st)

    def text(self, cid, x, y, w, h, html, *, size=11, align="center", italic=False, bold=False, bg=None,
             valign="middle"):
        fs = (2 if italic else 0) | (1 if bold else 0)
        st = (f"text;html=1;strokeColor=none;fillColor=none;whiteSpace=wrap;{FONT}fontSize={size};align={align};"
              f"verticalAlign={valign};fontStyle={fs};spacing=2;"
              + (f"labelBackgroundColor={bg};" if bg else ""))
        return self.vertex(cid, x, y, w, h, html, st)

    def label(self, x, y, w, html, *, h=None, size=11, align="center"):
        """Edge caption: free text on a white background, centred at (x, y)."""
        lines = html.count("<br>") + 1
        h = h or (15 * lines + 2)
        return self.text(None, x - w / 2, y - h / 2, w, h, html, size=size, align=align, bg="#FFFFFF")

    def actor(self, cid, x, y, w=30, h=44):
        st = f"shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;strokeColor=#000000;fillColor=#FFFFFF;"
        return self.vertex(cid, x, y, w, h, "", st)

    def dot(self, cid, x, y, r=12):
        st = "ellipse;html=1;strokeColor=#000000;fillColor=#000000;aspect=fixed;"
        return self.vertex(cid, x - r, y - r, 2 * r, 2 * r, "", st)

    def final(self, cid, x, y, r=13):
        st = "ellipse;shape=doubleEllipse;html=1;strokeColor=#000000;fillColor=#000000;aspect=fixed;margin=4;"
        cid = self._id(cid)
        # outer ring white with inner black disc
        self.vertex(cid, x - r, y - r, 2 * r, 2 * r, "", "ellipse;html=1;strokeColor=#000000;fillColor=#FFFFFF;aspect=fixed;")
        self.vertex(None, x - r + 5, y - r + 5, 2 * r - 10, 2 * r - 10, "", "ellipse;html=1;strokeColor=#000000;fillColor=#000000;aspect=fixed;")
        return cid

    def store(self, cid, x, y, w, h, num, name, size=12):
        """DFD data store: open-ended box with a number cell."""
        self.vertex(None, x, y, w, h, "", "shape=partialRectangle;html=1;top=1;bottom=1;left=1;right=0;fillColor=#FFFFFF;strokeColor=#000000;")
        self.vertex(None, x, y, 44, h, num, f"shape=partialRectangle;html=1;top=0;bottom=0;left=0;right=1;fillColor=none;strokeColor=#000000;{FONT}fontSize={size};")
        self.text(None, x + 50, y, w - 54, h, name, size=size, align="left")
        cid = self._id(cid)
        self.geo[cid] = (x, y, w, h)
        # invisible anchor for edges
        self.cells.append(
            f'<mxCell id="{cid}" value="" style="rounded=0;html=1;strokeColor=none;fillColor=none;" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        return cid

    def process(self, cid, x, y, w, h, num, name, size=12):
        """DFD process (Gane-Sarson style rounded box with number band)."""
        html = (f'<div style="border-bottom:1px solid #000;padding-bottom:3px;margin:0 6px 5px 6px;"><b>{num}</b></div>'
                f"{name}")
        return self.box(cid, x, y, w, h, html, rounded=True, size=size, valign="top", spacing=6,
                        extra="arcSize=10;")

    def table(self, cid, x, y, w, title, rows, *, rh=20, head=26, size=11):
        h = head + rh * len(rows)
        st = ("swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize=%d;horizontalStack=0;resizeParent=1;"
              "resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;strokeColor=#000000;"
              "fillColor=#FFFFFF;%sfontSize=12;swimlaneFillColor=#FFFFFF;" % (head, FONT))
        cid = self.vertex(cid, x, y, w, h, title, st)
        for i, r in enumerate(rows):
            rst = ("text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=6;"
                   f"spacingRight=4;overflow=hidden;rotatable=0;whiteSpace=wrap;{FONT}fontSize={size};")
            self.cells.append(
                f'<mxCell id="{cid}_r{i}" value="{esc(r)}" style="{rst}" vertex="1" parent="{cid}">'
                f'<mxGeometry x="0" y="{head + rh * i}" width="{w}" height="{rh}" as="geometry"/></mxCell>')
        return cid

    # ---- edges --------------------------------------------------------------------------------------------
    def edge(self, src, tgt, pts, *, dashed=False, start="none", end="block", start_fill=1, end_fill=1, width=1,
             cid=None, size=10):
        """pts: absolute polyline, first point on src border, last on tgt border."""
        cid = self._id(cid)
        sx, sy, sw, sh = self.geo[src]
        tx, ty, tw, th = self.geo[tgt]
        (x0, y0), (x1, y1) = pts[0], pts[-1]
        ex, ey = (x0 - sx) / sw, (y0 - sy) / sh
        nx, ny = (x1 - tx) / tw, (y1 - ty) / th
        st = (f"edgeStyle=none;html=1;rounded=0;strokeColor=#000000;{FONT}fontSize={size};endSize=9;startSize=9;"
              f"startArrow={start};endArrow={end};startFill={start_fill};endFill={end_fill};strokeWidth={width};"
              f"exitX={ex:.4f};exitY={ey:.4f};exitDx=0;exitDy=0;entryX={nx:.4f};entryY={ny:.4f};entryDx=0;entryDy=0;"
              + ("dashed=1;dashPattern=4 3;" if dashed else ""))
        mids = "".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in pts[1:-1])
        arr = f'<Array as="points">{mids}</Array>' if mids else ""
        self.cells.append(
            f'<mxCell id="{cid}" value="" style="{st}" edge="1" parent="1" source="{src}" target="{tgt}">'
            f'<mxGeometry relative="1" as="geometry">{arr}</mxGeometry></mxCell>')
        return cid

    def er(self, parent, child, pts, many=True, optional=True):
        """Parent (one, mandatory) -> child (zero/one-to-many or zero-to-one)."""
        end = ("ERzeroToMany" if optional else "ERoneToMany") if many else "ERzeroToOne"
        return self.edge(parent, child, pts, start="ERmandOne", end=end, start_fill=0, end_fill=0)

    def save(self, path, W, H):
        body = "".join(self.cells)
        xml = (f'<mxfile host="app.diagrams.net" agent="MASSO generator" version="24.0.0">'
               f'<diagram id="{self.name}" name="{self.name}"><mxGraphModel dx="{W}" dy="{H}" grid="1" gridSize="10" '
               f'guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="{W}" '
               f'pageHeight="{H}" background="#FFFFFF" math="0" shadow="0"><root><mxCell id="0"/>'
               f'<mxCell id="1" parent="0"/>{body}</root></mxGraphModel></diagram></mxfile>')
        with open(path, "w", encoding="utf-8") as f:
            f.write(xml)


def c4(name, kind, desc="", size_name=13):
    s = f'<b><span style="font-size:{size_name}px">{name}</span></b>'
    if kind:
        s += f'<br><span style="font-size:10px">[{kind}]</span>'
    if desc:
        s += f'<br><span style="font-size:11px">{desc}</span>'
    return s
