import { indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { EditorView, basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { useTheme } from "../theme";

// CodeMirror 6 editor for Python (Д-44). Tab indents; Esc then Tab moves focus out (CodeMirror's default).
const base = EditorView.theme({
  "&": { fontSize: "14px", height: "100%" },
  ".cm-scroller": { fontFamily: '"IBM Plex Mono", ui-monospace, monospace', lineHeight: "1.6" },
  ".cm-content": { padding: "12px 0" },
});
const light = EditorView.theme({
  "&": { backgroundColor: "var(--color-surface)", color: "var(--color-ink)" },
  ".cm-gutters": { backgroundColor: "var(--color-sunken)", color: "var(--color-muted)", border: "none" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--color-amber-bg) 45%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--color-amber-bg)" },
});
// One Dark syntax colours on the warm terminal background of the dark theme
const dark = [oneDark, Prec.highest(EditorView.theme({
  "&": { backgroundColor: "#1c1917" }, ".cm-gutters": { backgroundColor: "#1c1917" }, ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "#292524" },
}, { dark: true }))];

export function CodeEditor({ value, onChange, readOnly, label }: { value: string; onChange: (v: string) => void; readOnly?: boolean; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const themeSlot = useRef(new Compartment());
  const roSlot = useRef(new Compartment());
  const change = useRef(onChange);
  change.current = onChange;
  const [theme] = useTheme();

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup, python(), keymap.of([indentWithTab]), base,
          themeSlot.current.of(theme === "dark" ? dark : light),
          roSlot.current.of(EditorState.readOnly.of(!!readOnly)),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((u) => { if (u.docChanged) change.current(u.state.doc.toString()); }),
        ],
      }),
    });
    view.current = v;
    return () => { v.destroy(); view.current = null; };
    // the document is owned by the editor after mount; a new file remounts it (key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { view.current?.dispatch({ effects: themeSlot.current.reconfigure(theme === "dark" ? dark : light) }); }, [theme]);
  useEffect(() => { view.current?.dispatch({ effects: roSlot.current.reconfigure(EditorState.readOnly.of(!!readOnly)) }); }, [readOnly]);
  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}
