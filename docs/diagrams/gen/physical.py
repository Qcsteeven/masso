import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dio import Diagram  # noqa: E402
from facts import labels  # noqa: E402

OUT = Path("/home/lcatharsis/masso/docs/diagrams")
W = 320


def t(d, name, x, y, w=W):
    return d.table(name, x, y, w, name, labels(name))


# ---------------- fig22: core --------------------------------------------------------------------------------
d = Diagram("fig22_pg_core")
t(d, "users", 40, 40, 300)
t(d, "refresh_tokens", 40, 290, 300)
t(d, "assignments", 40, 490, 300)
t(d, "roles", 420, 40, 300)
t(d, "user_roles", 420, 200, 300)
t(d, "sessions", 800, 40)
t(d, "verification_results", 800, 500)
t(d, "environment_events", 1200, 40)
t(d, "hints", 1200, 290)
t(d, "reports", 1200, 540)
d.er("users", "user_roles", [(340, 150), (380, 150), (380, 230), (420, 230)])
d.er("roles", "user_roles", [(570, 146), (570, 200)])
d.er("users", "refresh_tokens", [(190, 226), (190, 290)])
d.er("users", "assignments", [(40, 120), (20, 120), (20, 570), (40, 570)])
d.er("users", "sessions", [(340, 200), (360, 200), (360, 330), (800, 330)])
d.er("sessions", "environment_events", [(1120, 140), (1200, 140)])
d.er("sessions", "hints", [(1120, 380), (1200, 380)])
d.er("sessions", "verification_results", [(960, 426), (960, 500)], many=False)
d.er("sessions", "reports", [(1120, 410), (1160, 410), (1160, 590), (1200, 590)], many=False)
d.text(None, 40, 770, 1480, 40,
       "Таблицы scenario_templates и scenario_runs приведены на рисунке 23. Линиями показаны основные связи; "
       "ссылки environment_events.user_id, assignments.created_by и verification_results.corrected_by на users "
       "указаны в описании полей (FK → таблица).", size=11, align="left", italic=True)
d.save(OUT / "fig22_pg_core.drawio", 1560, 820)

# ---------------- fig23: competency graph and scenarios -----------------------------------------------------
d = Diagram("fig23_pg_graph")
t(d, "domains", 420, 40)
t(d, "skills", 40, 180)
t(d, "track_targets", 420, 180)
t(d, "template_skills", 420, 330)
t(d, "scenario_templates", 800, 180)
t(d, "scenario_runs", 1180, 180)
t(d, "accepted_solutions", 800, 510)
t(d, "skill_requires", 40, 470)
t(d, "user_skills", 40, 620)
d.er("domains", "skills", [(420, 80), (200, 80), (200, 180)])
d.er("domains", "track_targets", [(580, 126), (580, 180)])
d.er("domains", "scenario_templates", [(740, 80), (960, 80), (960, 180)])
d.er("skills", "track_targets", [(360, 230), (420, 230)])
d.er("skills", "template_skills", [(360, 375), (420, 375)])
d.er("scenario_templates", "template_skills", [(800, 375), (740, 375)])
d.er("skills", "skill_requires", [(110, 406), (110, 470)])
d.er("skills", "skill_requires", [(270, 406), (270, 470)])
d.text(None, 116, 428, 80, 18, "skill_id", size=10, align="left")
d.text(None, 276, 428, 120, 18, "requires_skill_id", size=10, align="left")
d.er("skills", "user_skills", [(40, 300), (20, 300), (20, 700), (40, 700)])
d.er("scenario_templates", "scenario_runs", [(1120, 230), (1180, 230)])
d.er("scenario_templates", "accepted_solutions", [(960, 446), (960, 510)])
d.text(None, 420, 720, 1080, 60,
       "Таблицы users и sessions приведены на рисунке 22. Ссылки skills.created_by, scenario_templates.created_by, "
       "scenario_runs.user_id, user_skills.user_id, accepted_solutions.session_id и accepted_solutions.approved_by "
       "указаны в описании полей (FK → таблица). Векторные поля vector(1024) — тип расширения pgvector.",
       size=11, align="left", italic=True)
d.save(OUT / "fig23_pg_graph.drawio", 1540, 820)

# ---------------- fig24: operations -------------------------------------------------------------------------
d = Diagram("fig24_pg_ops")
t(d, "llm_providers", 40, 40)
t(d, "llm_settings", 420, 40)
t(d, "sandbox_profiles", 800, 40)
t(d, "audit_logs", 40, 350)
t(d, "security_events", 420, 350)
t(d, "agent_logs", 800, 350)
d.text(None, 40, 700, 1080, 40,
       "Таблицы users и sessions приведены на рисунке 22. Поля agent_logs.run_id и agent_logs.session_id "
       "хранят идентификаторы без внешнего ключа.", size=11, align="left", italic=True)
d.save(OUT / "fig24_pg_ops.drawio", 1160, 750)
print("ok")
