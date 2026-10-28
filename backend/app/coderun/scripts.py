"""Trusted helper scripts executed inside the sandbox next to the student's code (Д-44).

They never receive expected answers: the backend compares outputs (or their digest for big generated groups).
The student's own prints are captured and trimmed so they cannot push the result out of the exec output limit;
the result is printed last, after a marker line.
"""

MARKER = "@@MASSO-RESULT@@"

# argv[1]: JSON file {"func": name, "cases": [[args...], ...] | {"recipe": source, "kwargs": {...}}, "digest": bool}
CASES = r"""
import contextlib, hashlib, io, json, os, sys, traceback
sys.path.insert(0, "/srv/task" if os.path.isdir("/srv/task") else ".")
spec = json.load(open(sys.argv[1], encoding="utf-8"))
cases = spec["cases"]
shared = isinstance(cases, dict)  # big generated inputs are passed as is, small ones are copied per call
if shared:
    ns = {}
    exec(cases["recipe"], ns)
    cases = ns["make_cases"](**cases.get("kwargs", {}))
result = {"outputs": [], "errors": [], "import_error": None}
printed = io.StringIO()
fn = None
try:
    with contextlib.redirect_stdout(printed):
        import solution
    fn = getattr(solution, spec["func"])
except BaseException as exc:
    result["import_error"] = "".join(traceback.format_exception_only(type(exc), exc)).strip()[-800:]
if fn is not None:
    for args in cases:
        try:
            with contextlib.redirect_stdout(printed):
                out = fn(*(args if shared else json.loads(json.dumps(args))))
            result["outputs"].append(json.loads(json.dumps(out, default=list)))
            result["errors"].append(None)
        except BaseException as exc:
            result["outputs"].append(None)
            result["errors"].append(f"{type(exc).__name__}: {exc}"[:300])
if spec.get("digest"):
    canon = json.dumps(result.pop("outputs"), ensure_ascii=False, separators=(",", ":"))
    errs = [e for e in result.pop("errors") if e]
    result["digest"] = hashlib.sha256(canon.encode()).hexdigest()
    result["first_error"] = errs[0] if errs else None
print(printed.getvalue()[-3000:])
print("\n@@MASSO-RESULT@@" + json.dumps(result, ensure_ascii=False))
"""

# runs every test_* function of test_solution.py against the solution.py next to it
TESTS = r"""
import contextlib, io, json, os, sys, traceback
sys.path.insert(0, "/srv/task" if os.path.isdir("/srv/task") else ".")
result = {"total": 0, "passed": 0, "failures": [], "import_error": None}
printed = io.StringIO()
mod = None
try:
    with contextlib.redirect_stdout(printed):
        import test_solution as mod
except BaseException as exc:
    result["import_error"] = "".join(traceback.format_exception_only(type(exc), exc)).strip()[-800:]
if mod is not None:
    for name in sorted(n for n in dir(mod) if n.startswith("test") and callable(getattr(mod, n))):
        result["total"] += 1
        try:
            with contextlib.redirect_stdout(printed):
                getattr(mod, name)()
            result["passed"] += 1
        except BaseException as exc:
            msg = str(exc) or type(exc).__name__
            if isinstance(exc, AssertionError) and not str(exc):
                tb = traceback.extract_tb(exc.__traceback__)
                msg = f"assert в строке {tb[-1].lineno}: {tb[-1].line}" if tb else "AssertionError"
            result["failures"].append({"name": name, "error": msg[:400]})
print(printed.getvalue()[-3000:])
print("\n@@MASSO-RESULT@@" + json.dumps(result, ensure_ascii=False))
"""
