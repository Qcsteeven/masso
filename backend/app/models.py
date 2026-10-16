"""Import every model so that Base.metadata is complete (Alembic, tests)."""

from app.audit.models import AgentLog, AuditLog, SecurityEvent
from app.auth.models import RefreshToken
from app.db import Base
from app.events.models import EnvironmentEvent
from app.llm_gateway.models import LLMProvider, LLMSettings
from app.reports.models import Report
from app.sandbox.models import SandboxProfile
from app.scenarios.models import AcceptedSolution, Assignment, ScenarioRun, ScenarioTemplate, TemplateSkill
from app.sessions.models import Hint, LearningSession
from app.skills.models import Domain, Skill, SkillRequires, TrackTarget, UserSkill
from app.users.models import Role, User, UserRole
from app.verification.models import VerificationResult

__all__ = [
    "AcceptedSolution",
    "AgentLog",
    "Assignment",
    "AuditLog",
    "Base",
    "Domain",
    "EnvironmentEvent",
    "Hint",
    "LLMProvider",
    "LLMSettings",
    "LearningSession",
    "RefreshToken",
    "Report",
    "Role",
    "SandboxProfile",
    "ScenarioRun",
    "ScenarioTemplate",
    "SecurityEvent",
    "Skill",
    "SkillRequires",
    "TemplateSkill",
    "TrackTarget",
    "User",
    "UserRole",
    "UserSkill",
    "VerificationResult",
]
