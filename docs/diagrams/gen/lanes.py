"""BPMN-like swimlane process diagrams on a grid with explicit orthogonal routing."""

from common import FONT, FS, LINE_H, Doc, lines_html, tw, wrap

HEAD = 40
X0 = 20
Y0 = 20
S = "strokeColor=#000000;fontColor=#000000;"


class Lanes:
    def __init__(self, name, lanes, cw=170, tw_=140, lane_h=None):
        self.name = name
        self.lanes = lanes
        self.cw = cw
        self.tw = tw_
        self.lane_h = lane_h or [130] * len(lanes)
        self.nodes = {}
        self.order = []
        self.flows = []
        self.ncols = 0
        self.extra = 0

    # geometry helpers
    def lane_top(self, i):
        return Y0 + sum(self.lane_h[:i])

    def lane_mid(self, i):
        return self.lane_top(i) + self.lane_h[i] / 2

    def cx(self, col):
        return X0 + HEAD + 20 + self.cw * col + self.cw / 2

    def _add(self, nid, kind, lane, col, text, **kw):
        self.nodes[nid] = dict(kind=kind, lane=lane, col=col, text=text, **kw)
        self.order.append(nid)
        self.ncols = max(self.ncols, col + 1)

    def start(self, nid, lane, col, text, lpos="below"):
        self._add(nid, "start", lane, col, text, lpos=lpos)

    def end(self, nid, lane, col, text, lpos="below"):
        self._add(nid, "end", lane, col, text, lpos=lpos)

    def task(self, nid, lane, col, text, dy=0):
        self._add(nid, "task", lane, col, text, dy=dy)

    def gw(self, nid, lane, col, text, qpos="above", dy=0, par=False, qw=125):
        self._add(nid, "gw", lane, col, text, qpos=qpos, dy=dy, par=par, qw=qw)

    def flow(self, a, b, label="", out=None, inn=None, via=None, xm=None, lpos=None):
        self.flows.append(dict(a=a, b=b, label=label, out=out, inn=inn, via=via, xm=xm, lpos=lpos))

    def box(self, nid):
        n = self.nodes[nid]
        cx = self.cx(n["col"])
        cy = self.lane_mid(n["lane"]) + n.get("dy", 0)
        if n["kind"] == "task":
            lines = wrap(n["text"], self.tw - 12)
            h = max(56, len(lines) * LINE_H + 14)
            return cx - self.tw / 2, cy - h / 2, self.tw, h
        if n["kind"] == "gw":
            return cx - 23, cy - 23, 46, 46
        return cx - 16, cy - 16, 32, 32

    def port(self, nid, side):
        x, y, w, h = self.box(nid)
        return {"right": (x + w, y + h / 2), "left": (x, y + h / 2), "top": (x + w / 2, y),
                "bottom": (x + w / 2, y + h)}[side]

    def build(self, path):
        doc = Doc(self.name)
        W = HEAD + 40 + self.cw * self.ncols + self.extra
        ids = {}
        for i, name in enumerate(self.lanes):
            st = (f"swimlane;horizontal=0;startSize={HEAD};html=1;whiteSpace=wrap;collapsible=0;{S}fillColor=#FFFFFF;"
                  f"fontFamily={FONT};fontSize={FS + 1};fontStyle=1;swimlaneFillColor=#FFFFFF;")
            hl = wrap(name, self.lane_h[i] - 10, size=FS + 1, bold=True)
            doc.vertex(X0, self.lane_top(i), W, self.lane_h[i], lines_html(hl), st)
        for nid in self.order:
            n = self.nodes[nid]
            x, y, w, h = self.box(nid)
            if n["kind"] == "task":
                st = (f"rounded=1;arcSize=12;whiteSpace=wrap;html=1;{S}fillColor=#FFFFFF;fontFamily={FONT};"
                      f"fontSize={FS};spacing=4;")
                ids[nid] = doc.vertex(x, y, w, h, lines_html(wrap(n["text"], self.tw - 12)), st)
            elif n["kind"] == "gw":
                plus = n.get("par")
                ids[nid] = doc.vertex(x, y, w, h, "+" if plus else "",
                                      f"rhombus;whiteSpace=wrap;html=1;{S}fillColor=#FFFFFF;fontSize=22;"
                                      f"fontFamily={FONT};verticalAlign=middle;spacingBottom=3;")
                if not n["text"]:
                    continue
                lines = wrap(n["text"], n.get("qw", 125))
                lh = len(lines) * LINE_H + 2
                q = n["qpos"]
                if q == "above":
                    doc.text(x + w / 2, y - lh - 3, lines, bg=True)
                elif q == "below":
                    doc.text(x + w / 2, y + h + 3, lines, bg=True)
                elif q == "aboveleft":
                    doc.text(x + w / 2 - 6, y - lh + 6, lines, align="right", bg=True)
                elif q == "aboveright":
                    doc.text(x + w / 2 + 6, y - lh + 6, lines, align="left", bg=True)
                elif q == "belowleft":
                    doc.text(x + w / 2 - 6, y + h - 6, lines, align="right", bg=True)
                elif q == "belowright":
                    doc.text(x + w / 2 + 6, y + h - 6, lines, align="left", bg=True)
            else:
                sw = 1 if n["kind"] == "start" else 3
                ids[nid] = doc.vertex(x, y, w, h, "", f"ellipse;html=1;aspect=fixed;{S}fillColor=#FFFFFF;strokeWidth={sw};")
                lines = wrap(n["text"], 140)
                lh = len(lines) * LINE_H + 2
                lp = n["lpos"]
                if lp == "below":
                    doc.text(x + w / 2, y + h + 3, lines, bg=True)
                elif lp == "above":
                    doc.text(x + w / 2, y - lh - 3, lines, bg=True)
                elif lp == "right":
                    doc.text(x + w + 5, y + h / 2 - lh / 2, lines, align="left", bg=True)
                else:
                    doc.text(x - 5, y + h / 2 - lh / 2, lines, align="right", bg=True)
        for f in self.flows:
            a, b = self.nodes[f["a"]], self.nodes[f["b"]]
            out, inn = f["out"], f["inn"]
            if out is None or inn is None:
                if a["lane"] == b["lane"] and b["col"] > a["col"]:
                    out, inn = out or "right", inn or "left"
                elif a["col"] == b["col"]:
                    down = b["lane"] > a["lane"]
                    out, inn = out or ("bottom" if down else "top"), inn or ("top" if down else "bottom")
                elif b["col"] > a["col"]:
                    out, inn = out or "right", inn or "left"
                else:
                    out, inn = out or "top", inn or "top"
            sp, tp = self.port(f["a"], out), self.port(f["b"], inn)
            pts = []
            if f["via"] is not None:
                pts = f["via"]
            elif out in ("right", "left") and inn in ("left", "right"):
                if abs(sp[1] - tp[1]) > 0.5:
                    if f["xm"] is not None:
                        xm = f["xm"]
                    elif b["col"] > a["col"]:
                        xm = self.cx(b["col"]) - self.cw / 2
                    else:
                        xm = (sp[0] + tp[0]) / 2
                    pts = [(xm, sp[1]), (xm, tp[1])]
            elif out in ("top", "bottom") and inn in ("left", "right"):
                pts = [(sp[0], tp[1])]
            elif out in ("right", "left") and inn in ("top", "bottom"):
                pts = [(tp[0], sp[1])]
            elif out in ("top", "bottom") and inn in ("top", "bottom"):
                if abs(sp[0] - tp[0]) > 0.5:
                    ym = (sp[1] + tp[1]) / 2
                    pts = [(sp[0], ym), (tp[0], ym)]
            cons = {"right": (1, 0.5), "left": (0, 0.5), "top": (0.5, 0), "bottom": (0.5, 1)}
            ex, ey = cons[out]
            nx, ny = cons[inn]
            st = (f"edgeStyle=none;rounded=0;html=1;endArrow=block;endFill=1;endSize=7;strokeColor=#000000;"
                  f"exitX={ex};exitY={ey};exitDx=0;exitDy=0;exitPerimeter=0;entryX={nx};entryY={ny};entryDx=0;"
                  f"entryDy=0;entryPerimeter=0;")
            doc.edge(st, pts, src=ids[f["a"]], tgt=ids[f["b"]])
            if f["label"]:
                lls = f["label"].split("\n")
                lw = max(tw(x) for x in lls) + 6
                nl = len(lls)
                lp = f["lpos"]
                if lp is not None:
                    lx, ly = lp
                elif out == "right":
                    lx, ly = sp[0] + 4, sp[1] - nl * LINE_H - 3
                elif out == "left":
                    lx, ly = sp[0] - 4 - lw, sp[1] - nl * LINE_H - 3
                elif out == "bottom":
                    lx, ly = sp[0] + 4, sp[1] + 2
                else:
                    lx, ly = sp[0] + 4, sp[1] - nl * LINE_H - 4
                doc.text(lx, ly, lls, align="left", bg=True)
        doc.save(path)
