"""UML sequence diagram generator: auto layout, numbering, activations, fragments; labels never cross bars."""

from common import FONT, FS, LINE_H, Doc, lines_html, tw, wrap

MAXW = 330  # wrap width of a message label
BAR = 10
TOP = 20
STROKE = "strokeColor=#000000;fontColor=#000000;"


class Seq:
    def __init__(self, name: str, maxw: float = MAXW) -> None:
        self.name = name
        self.parts: list[dict] = []
        self.idx: dict[str, int] = {}
        self.ev: list[dict] = []
        self.maxw = maxw
        self.num = 0

    # ---------------- participants
    def actor(self, pid: str, label: str) -> None:
        self._p(pid, label, True)

    def part(self, pid: str, label: str) -> None:
        self._p(pid, label, False)

    def _p(self, pid, label, actor):
        self.idx[pid] = len(self.parts)
        self.parts.append({"id": pid, "label": label, "actor": actor})

    # ---------------- events
    def _msg(self, kind, a, b, text, numbered=True, act=True):
        import re

        text = re.sub(r"(\d) (с|мин|ч|дней|МБ|%|pids|CPU)(?=[\s,;.)]|$)", "\\1\u00a0\\2", text)
        if numbered:
            self.num += 1
            text = f"{self.num}: {text}"
        self.ev.append({"t": "msg", "kind": kind, "a": a, "b": b, "text": text, "act": act})

    def call(self, a, b, text, act=True):
        """act=False: the receiver continues its current activation (no new bar)."""
        self._msg("sync", a, b, text, act=act)

    def reply(self, a, b, text, act=True):
        """act=False: the sender keeps its activation."""
        self._msg("reply", a, b, text, act=act)

    def send(self, a, b, text):
        """Asynchronous message (open arrow), short activation of the receiver."""
        self._msg("async", a, b, text)

    def self_(self, a, text):
        self._msg("self", a, a, text)

    def activate(self, p):
        self.ev.append({"t": "act", "p": p})

    def deactivate(self, p):
        self.ev.append({"t": "deact", "p": p})

    def frag(self, kind, guard, keep=False):
        self.ev.append({"t": "frag", "kind": kind, "guard": guard, "keep": keep})

    def alt(self, guard, keep=False):
        self.frag("alt", guard, keep)

    def opt(self, guard):
        self.frag("opt", guard)

    def loop(self, guard):
        self.frag("loop", guard)

    def else_(self, guard):
        self.ev.append({"t": "else", "guard": guard})

    def end(self):
        self.ev.append({"t": "end"})

    def note(self, p, text, width=260):
        self.ev.append({"t": "note", "p": p, "text": text, "w": width})

    def gap(self, h=10):
        self.ev.append({"t": "gap", "h": h})

    # ---------------- layout
    def build(self, path: str) -> None:
        P = self.parts
        n = len(P)
        stacks: dict[str, list[float]] = {p["id"]: [] for p in P}
        bars: list[list] = []  # [pid, depth, y0, y1]
        frames: list[dict] = []
        fstack: list[dict] = []
        drawn: list[dict] = []
        y = TOP + 78
        actor_of = {p["id"]: p["actor"] for p in P}

        def push(p, y0):
            if actor_of[p]:
                return None
            stacks[p].append(y0)
            return len(stacks[p]) - 1

        def pop(p, y1):
            if actor_of[p] or not stacks[p]:
                return None
            d = len(stacks[p]) - 1
            y0 = stacks[p].pop()
            bars.append([p, d, y0, max(y1, y0 + 16)])
            return d

        def top(p):
            if actor_of[p] or not stacks[p]:
                return None
            return len(stacks[p]) - 1

        def touch_frames(*ps):
            for f in fstack:
                f["parts"].update(ps)

        for e in self.ev:
            t = e["t"]
            if t == "msg":
                mw = self.maxw if e["kind"] != "self" else min(self.maxw, 210)
                toks = e["text"].split(" ")
                if len(toks) >= 3 and toks[1] in ("GET", "POST", "PUT", "PATCH", "DELETE", "WS"):
                    mw = max(mw, tw(" ".join(toks[:3])) + 4)  # keep «N: METHOD /url» on one line
                lines = wrap(e["text"], mw)
                lh = len(lines) * LINE_H
                a, b, k = e["a"], e["b"], e["kind"]
                touch_frames(a, b)
                if k == "self":
                    y += 8
                    ay = y
                    da = top(a)
                    d_in = push(a, ay + 10)
                    pop(a, ay + 30)
                    drawn.append({"t": "self", "p": a, "y": ay, "lines": lines, "da": da, "din": d_in})
                    y = ay - 4 + max(lh + 2, 32) + 12
                    continue
                y += lh + 6
                ay = y
                da = top(a)
                if k == "sync":
                    db = push(b, ay) if e["act"] else top(b)
                elif k == "reply":
                    da = pop(a, ay) if e["act"] else top(a)
                    db = top(b)
                else:  # async
                    db = None if actor_of[b] else len(stacks[b])
                    if db is not None:
                        bars.append([b, db, ay - 2, ay + 16])
                drawn.append({"t": "msg", "k": k, "a": a, "b": b, "y": ay, "lines": lines, "da": da, "db": db})
                y = ay + 12
            elif t == "act":
                push(e["p"], y)
            elif t == "deact":
                pop(e["p"], y)
            elif t == "gap":
                y += e["h"]
            elif t == "note":
                lines = wrap(e["text"], e["w"] - 16)
                h = len(lines) * LINE_H + 10
                y += 6
                drawn.append({"t": "note", "p": e["p"], "y": y, "lines": lines, "h": h})
                touch_frames(e["p"])
                y += h + 8
            elif t == "frag":
                y += 6
                f = {
                    "kind": e["kind"], "y0": y, "guards": [(y, e["guard"])], "parts": set(), "depth": len(fstack),
                    "snap": {p: list(s) for p, s in stacks.items()}, "inner": 0, "keep": e["keep"],
                }
                for g in fstack:
                    g["inner"] = max(g["inner"], len(fstack) - g["depth"])
                fstack.append(f)
                frames.append(f)
                f["glines"] = [wrap(f"[{e['guard']}]", 250, italic=True)]
                y += 11 + LINE_H * len(f["glines"][0])
            elif t == "else":
                f = fstack[-1]
                y += 8
                f["guards"].append((y, e["guard"]))
                f["glines"].append(wrap(f"[{e['guard']}]", 250, italic=True))
                # activations that were open when the fragment began continue in every operand
                for p, snap in ({} if f["keep"] else f["snap"]).items():
                    while len(stacks[p]) > len(snap):
                        pop(p, y - 8)
                    while len(stacks[p]) < len(snap):
                        stacks[p].append(y)
                y += 12 + LINE_H * len(f["glines"][-1])
            elif t == "end":
                f = fstack.pop()
                y += 8
                f["y1"] = y
                if fstack:
                    fstack[-1]["parts"].update(f["parts"])
                y += 10
        y_end = y + 16
        for p, s in stacks.items():
            while s:
                pop(p, y_end - 10)

        # ---------------- horizontal layout
        headw = []
        headlines = []
        for p in P:
            if p["actor"]:
                headlines.append([p["label"]])
                headw.append(max(40.0, tw(p["label"]) + 10))
            else:
                ls = wrap(p["label"], 150) if tw(p["label"]) > 170 else [p["label"]]
                headlines.append(ls)
                headw.append(max(110.0, max(tw(s) for s in ls) + 24))
        gaps = [max(headw[i] / 2 + headw[i + 1] / 2 + 24, 130.0) for i in range(n - 1)]
        right_extra = 0.0
        cons = []
        for d in drawn:
            if d["t"] == "msg":
                i, j = sorted((self.idx[d["a"]], self.idx[d["b"]]))
                w = max(tw(s) for s in d["lines"]) + 6
                cons.append((j - i, i, j, w + 40))
            elif d["t"] == "self":
                i = self.idx[d["p"]]
                w = max(tw(s) for s in d["lines"]) + 6
                if i < n - 1:
                    cons.append((1, i, i + 1, 46 + w + 18))
                else:
                    right_extra = max(right_extra, 46 + w + 10 - headw[i] / 2)
            elif d["t"] == "note":
                i = self.idx[d["p"]]
                w = max(tw(s) for s in d["lines"]) + 20
                if i < n - 1:
                    cons.append((1, i, i + 1, 16 + w + 16))
                else:
                    right_extra = max(right_extra, 16 + w)
        for f in frames:
            gw = tw(f["kind"], bold=True) + 22 + max(tw(g, italic=True) for _, g in f["guards"]) + 30
            ids = sorted(self.idx[p] for p in f["parts"]) or [0]
            if ids[-1] > ids[0]:
                cons.append((ids[-1] - ids[0], ids[0], ids[-1], gw - 40))
            f["lpad"] = 12 + tw(f["kind"], bold=True) + 22 + 10 * f["inner"]
            f["lo"], f["hi"] = ids[0], ids[-1]
            gmax = max(max(tw(x, italic=True) for x in gl) for gl in f["glines"]) + 6
            if ids[0] < n - 1:
                cons.append((1, ids[0], ids[0] + 1, gmax + 34))
            else:
                right_extra = max(right_extra, gmax + 40)
            if ids[0] > 0:
                cons.append((1, ids[0] - 1, ids[0], f["lpad"] + 20 + (headw[ids[0] - 1] / 2 if False else 8)))
        for span, i, j, need in sorted(cons):
            have = sum(gaps[i:j])
            if have < need:
                add = (need - have) / (j - i)
                for k in range(i, j):
                    gaps[k] += add
        maxpad = max([f["lpad"] for f in frames if f["lo"] == 0], default=0)
        left = 20 + max(0.0, maxpad + 6 - headw[0] / 2)
        cx = [left + headw[0] / 2]
        for g in gaps:
            cx.append(cx[-1] + g)
        X = {p["id"]: cx[i] for i, p in enumerate(P)}

        def bar_x(p, d):
            return X[p] - BAR / 2 + 5 * d

        bar_rects = [(bar_x(p, d), y0, bar_x(p, d) + BAR, y1) for p, d, y0, y1 in bars]

        def free(x0, y0, x1, y1):
            return not any(bx0 < x1 and x0 < bx1 and by0 < y1 and y0 < by1 for bx0, by0, bx1, by1 in bar_rects)

        def place(cxm, w, y0, y1, lo, hi):
            """Leftmost x of a box of width w near centre cxm within [lo, hi] that does not cross a bar."""
            cands = [cxm - w / 2]
            for bx0, by0, bx1, by1 in bar_rects:
                if by0 < y1 and y0 < by1:
                    cands += [bx1 + 4, bx0 - 4 - w]
            cands = [c for c in cands if lo <= c and c + w <= hi]
            cands.sort(key=lambda c: abs(c + w / 2 - cxm))
            for c in cands:
                if free(c, y0, c + w, y1):
                    return c
            return max(lo, min(cxm - w / 2, hi - w))

        doc = Doc(self.name)
        # frames (behind everything)
        for f in frames:
            ids = sorted(self.idx[p] for p in f["parts"]) or [0]
            pad = 14 + 10 * f["inner"]
            fl = cx[ids[0]] - f["lpad"]
            fr = cx[ids[-1]] + pad + 6
            if ids[-1] == ids[0]:
                fr = max(fr, fl + 260)
            tabw = tw(f["kind"], bold=True) + 22
            st = (
                f"shape=umlFrame;whiteSpace=wrap;html=1;width={tabw:.0f};height=20;boundedLbl=1;verticalAlign=middle;"
                f"align=center;spacingLeft=0;fontStyle=1;fontFamily={FONT};fontSize={FS};{STROKE}"
                "fillColor=#FFFFFF;swimlaneFillColor=none;"
            )
            doc.vertex(fl, f["y0"], fr - fl, f["y1"] - f["y0"], f["kind"], st)
            f["box"] = (fl, fr, tabw)
        # lifelines
        for i, p in enumerate(P):
            h = y_end - TOP
            if p["actor"]:
                st = (
                    "shape=umlLifeline;participant=umlActor;perimeter=lifelinePerimeter;whiteSpace=nowrap;html=1;"
                    "container=0;collapsible=0;recursiveResize=0;verticalAlign=top;spacingTop=40;outlineConnect=0;"
                    f"portConstraint=eastwest;size=40;{STROKE}fillColor=#FFFFFF;fontFamily={FONT};fontSize={FS};"
                    ""
                )
                doc.vertex(cx[i] - 20, TOP, 40, h, lines_html(headlines[i]), st)
            else:
                st = (
                    "shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=0;collapsible=0;"
                    f"recursiveResize=0;outlineConnect=0;portConstraint=eastwest;size=46;{STROKE}fillColor=#FFFFFF;"
                    f"fontFamily={FONT};fontSize={FS};"
                )
                doc.vertex(cx[i] - headw[i] / 2, TOP, headw[i], h, lines_html(headlines[i]), st)
        # bars
        for p, d, y0, y1 in bars:
            doc.vertex(bar_x(p, d), y0, BAR, y1 - y0, "", f"html=1;points=[];perimeter=orthogonalPerimeter;"
                       f"{STROKE}fillColor=#FFFFFF;")
        # fragment guards and separators
        for f in frames:
            fl, fr, tabw = f["box"]
            i0 = f["lo"]
            for k, (gy, g) in enumerate(f["guards"]):
                if k > 0:
                    doc.edge("endArrow=none;dashed=1;html=1;strokeColor=#000000;", [], sp=(fl, gy), tp=(fr, gy))
                gl = f["glines"][k]
                w = max(tw(x, italic=True) for x in gl) + 6
                ty = gy + (3 if k == 0 else 4)
                ty1 = ty + LINE_H * len(gl) + 2
                lo = fl + (tabw + 6 if k == 0 else 6)
                hi = (cx[i0 + 1] - 8) if i0 < n - 1 else fr - 4
                # right after the bars of the frame's first lifeline
                pid = P[i0]["id"]
                for bx0, by0, bx1, by1 in [(bar_x(p_, d_), a_, bar_x(p_, d_) + BAR, b_) for p_, d_, a_, b_ in bars
                                           if p_ == pid]:
                    if by0 < ty1 and ty < by1:
                        lo = max(lo, bx1 + 4)
                lo = max(lo, fl + (tabw + 6 if k == 0 else 6))
                x0 = place(lo + w / 2, w, ty, ty1, lo, max(hi, lo + w))
                doc.text(x0, ty, gl, align="left", italic=True)
        # messages
        for d in drawn:
            if d["t"] == "note":
                p = d["p"]
                w = max(tw(s) for s in d["lines"]) + 20
                x0 = X[p] + 16
                doc.vertex(x0, d["y"], w, d["h"], lines_html(d["lines"]),
                           f"shape=note;size=10;whiteSpace=nowrap;html=1;align=left;spacingLeft=8;{STROKE}"
                           f"fillColor=#FFFFFF;fontFamily={FONT};fontSize={FS};")
                continue
            if d["t"] == "self":
                p = d["p"]
                xa = X[p] + BAR / 2 + 5 * (d["da"] or 0) if d["da"] is not None else X[p]
                xb = bar_x(p, d["din"]) + BAR
                ay = d["y"]
                loop_x = X[p] + 40
                doc.edge(f"endArrow=block;endFill=1;endSize=7;html=1;rounded=0;strokeColor=#000000;",
                         [(loop_x, ay), (loop_x, ay + 20)], sp=(xa, ay), tp=(xb, ay + 20))
                w = max(tw(s) for s in d["lines"]) + 6
                lh = len(d["lines"]) * LINE_H + 2
                doc.text(loop_x + 6, ay - 4 if lh > 32 else ay + 10 - lh / 2, d["lines"], align="left")
                continue
            a, b, k, ay = d["a"], d["b"], d["k"], d["y"]
            ia, ib = self.idx[a], self.idx[b]
            right = ib > ia
            if actor_of[a] or d["da"] is None:
                xs = X[a]
            else:
                xs = bar_x(a, d["da"]) + (BAR if right else 0)
            if actor_of[b] or d["db"] is None:
                xe = X[b]
            else:
                xe = bar_x(b, d["db"]) + (0 if right else BAR)
            if k == "sync":
                st = "endArrow=block;endFill=1;endSize=8;html=1;strokeColor=#000000;"
            elif k == "reply":
                st = "endArrow=open;endFill=0;endSize=8;dashed=1;html=1;strokeColor=#000000;"
            else:
                st = "endArrow=open;endFill=0;endSize=8;html=1;strokeColor=#000000;"
            doc.edge(st, [], sp=(xs, ay), tp=(xe, ay))
            w = max(tw(s) for s in d["lines"]) + 6
            lh = len(d["lines"]) * LINE_H + 2
            lo, hi = min(xs, xe) + 4, max(xs, xe) - 4
            y0 = ay - lh - 1
            x0 = place((xs + xe) / 2, w, y0, ay - 1, lo, hi)
            doc.text(x0, y0, d["lines"], align="left", pad=3)
        doc.maxx = max(doc.maxx, cx[-1] + headw[-1] / 2 + right_extra)
        doc.save(path)
