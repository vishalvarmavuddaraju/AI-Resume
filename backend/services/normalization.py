"""
Skill Canonicalization Layer

Deterministic normalization pipeline for skill strings extracted from
Job Descriptions and Resumes. Ensures equivalent representations resolve
to the same canonical token before matching/scoring.

Pipeline stages:
  1. Structural Normalization — whitespace, punctuation, slash cleanup
  2. Alias Mapping — controlled dictionary lookup
  3. Category Preservation — canonical token stays in its original category
"""

import json
import logging
import os
import re
from copy import deepcopy
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

_ALIAS_MAP_DIR = os.path.join(
    os.path.dirname(__file__), "..", "resources", "normalization"
)
_DEFAULT_ALIAS_MAP_FILE = "alias_map.json"


class NormalizationLog:
    """Stores audit trail entries for every transformation."""

    def __init__(self) -> None:
        self.entries: List[Dict[str, str]] = []

    def record(self, original: str, normalized: str, canonical: str) -> None:
        self.entries.append(
            {
                "original": original,
                "normalized": normalized,
                "canonical": canonical,
            }
        )

    def changed_only(self) -> List[Dict[str, str]]:
        """Return only entries where the canonical differs from the original."""
        return [e for e in self.entries if e["original"] != e["canonical"]]

    def to_list(self) -> List[Dict[str, str]]:
        return list(self.entries)

    def __repr__(self) -> str:
        return f"NormalizationLog({len(self.entries)} entries, {len(self.changed_only())} changed)"


class SkillNormalizer:
    """
    Deterministic skill canonicalization engine.

    Usage:
        normalizer = SkillNormalizer()
        result, log = normalizer.normalize_structured_jd(jd_json)
        result, log = normalizer.normalize_resume_skills(resume_json)
    """

    def __init__(self, alias_map_path: Optional[str] = None) -> None:
        path = alias_map_path or os.path.join(_ALIAS_MAP_DIR, _DEFAULT_ALIAS_MAP_FILE)
        self._alias_map, self._version = self._load_alias_map(path)

    @property
    def version(self) -> str:
        return self._version

    @property
    def alias_count(self) -> int:
        return len(self._alias_map)

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------

    @staticmethod
    def _load_alias_map(path: str) -> Tuple[Dict[str, str], str]:
        """Load alias map JSON and return (aliases_dict, version_string)."""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        version = data.get("version", "unknown")
        aliases = data.get("aliases", {})
        validated: Dict[str, str] = {}
        for key, val in aliases.items():
            if not isinstance(key, str) or not isinstance(val, str):
                logger.warning("Skipping invalid alias entry: %s -> %s", key, val)
                continue
            validated[key.lower().strip()] = val
        logger.info(
            "Loaded alias map v%s with %d entries from %s",
            version,
            len(validated),
            path,
        )
        return validated, version

    # ------------------------------------------------------------------
    # Stage 1 — Structural Normalization
    # ------------------------------------------------------------------

    @staticmethod
    def _structural_normalize(skill: str) -> str:
        """
        Safe formatting cleanup:
        - Strip leading/trailing whitespace
        - Collapse multiple internal spaces
        - Remove trailing punctuation (except +, #, and .)
        - Standardize slash spacing (remove spaces around /)
        - Lowercase for lookup
        """
        s = skill.strip()
        s = re.sub(r"\s+", " ", s)
        s = re.sub(r"\s*/\s*", "/", s)
        s = re.sub(r"[,;:!?]+$", "", s)
        s = s.lower()
        return s

    # ------------------------------------------------------------------
    # Stage 2 — Alias Mapping
    # ------------------------------------------------------------------

    def _alias_resolve(self, normalized: str) -> str:
        """
        Controlled dictionary lookup.
        If no mapping exists, return the normalized value as-is (title-cased).
        """
        return self._alias_map.get(normalized, normalized)

    # ------------------------------------------------------------------
    # Full Single-Skill Pipeline
    # ------------------------------------------------------------------

    def normalize_skill(
        self, skill: str, audit_log: Optional[NormalizationLog] = None
    ) -> str:
        """
        Run the full 3-stage pipeline on a single skill string.
        Returns the canonical form.
        """
        original = skill
        normalized = self._structural_normalize(skill)
        canonical = self._alias_resolve(normalized)

        if canonical == normalized:
            canonical = self._preserve_display_form(original, normalized)

        if audit_log is not None:
            audit_log.record(original, normalized, canonical)

        return canonical

    @staticmethod
    def _preserve_display_form(original: str, normalized: str) -> str:
        """
        When no alias match is found, return a cleaned version of the
        original that preserves intentional casing (e.g. 'GraphQL')
        rather than the lowercased normalized form.
        """
        cleaned = original.strip()
        cleaned = re.sub(r"\s+", " ", cleaned)
        cleaned = re.sub(r"\s*/\s*", "/", cleaned)
        cleaned = re.sub(r"[,;:!?]+$", "", cleaned)
        return cleaned

    # ------------------------------------------------------------------
    # List-level Normalization (with dedup)
    # ------------------------------------------------------------------

    def normalize_skill_list(
        self,
        skills: List[str],
        audit_log: Optional[NormalizationLog] = None,
    ) -> List[str]:
        """
        Normalize a list of skills and deduplicate.
        Preserves order of first occurrence.
        """
        seen: set = set()
        result: List[str] = []
        for skill in skills:
            canonical = self.normalize_skill(skill, audit_log)
            key = canonical.lower()
            if key not in seen:
                seen.add(key)
                result.append(canonical)
        return result

    # ------------------------------------------------------------------
    # Structured JD Normalization
    # ------------------------------------------------------------------

    def normalize_structured_jd(
        self, jd_json: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], NormalizationLog]:
        """
        Normalize a structured JD (output of jd_structurer).

        Processes:
        - technical_requirements.must_have.<category>
        - technical_requirements.preferred.<category>
        - raw_extracted_keywords

        Category assignment is preserved (Stage 3).
        Returns (normalized_jd, audit_log).
        """
        audit_log = NormalizationLog()
        result = deepcopy(jd_json)

        tech_req = result.get("technical_requirements", {})
        categories = [
            "programming_languages",
            "cloud_platforms",
            "frameworks_tools",
            "databases",
        ]

        for tier in ["must_have", "preferred"]:
            tier_data = tech_req.get(tier, {})
            for category in categories:
                skills = tier_data.get(category, [])
                if skills:
                    tier_data[category] = self.normalize_skill_list(
                        skills, audit_log
                    )

        raw_keywords = result.get("raw_extracted_keywords", [])
        if raw_keywords:
            result["raw_extracted_keywords"] = self.normalize_skill_list(
                raw_keywords, audit_log
            )

        return result, audit_log

    # ------------------------------------------------------------------
    # Resume Skills Normalization
    # ------------------------------------------------------------------

    def normalize_resume_skills(
        self, resume_json: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], NormalizationLog]:
        """
        Normalize skills in a structured resume JSON.

        Processes:
        - resume.sections.technical_skills.categories[].items

        Category assignment is preserved (Stage 3).
        Returns (normalized_resume, audit_log).
        """
        audit_log = NormalizationLog()
        result = deepcopy(resume_json)

        sections = result.get("resume", {}).get("sections", {})
        tech_skills = sections.get("technical_skills", {})
        categories = tech_skills.get("categories", [])

        for cat in categories:
            items = cat.get("items", [])
            if items:
                cat["items"] = self.normalize_skill_list(items, audit_log)

        return result, audit_log

    # ------------------------------------------------------------------
    # Convenience: Normalize both JD and resume together
    # ------------------------------------------------------------------

    def normalize_pair(
        self, jd_json: Dict[str, Any], resume_json: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], Dict[str, Any], NormalizationLog, NormalizationLog]:
        """
        Normalize both JD and resume in one call.
        Returns (normalized_jd, normalized_resume, jd_log, resume_log).
        """
        norm_jd, jd_log = self.normalize_structured_jd(jd_json)
        norm_resume, resume_log = self.normalize_resume_skills(resume_json)
        return norm_jd, norm_resume, jd_log, resume_log
