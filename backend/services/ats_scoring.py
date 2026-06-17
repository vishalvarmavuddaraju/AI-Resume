"""
Conservative FAANG-calibrated ATS scoring engine.

Takes gap analysis JSON (from the ATS Gap Analyzer) and computes a deterministic
risk-weighted score. See backend/docs/ats_scoring_layer.md for the full spec.
"""

from __future__ import annotations

from typing import Any


def compute_ats_score(gap_analysis: dict[str, Any]) -> dict[str, Any]:
    """
    Compute ATS score from gap analysis.

    Args:
        gap_analysis: Dict with must_have_analysis, preferred_analysis,
            experience_requirement, required_cloud_status.
            Optional: hard_fail_flags (ignored; we derive risk_factors ourselves).

    Returns:
        Dict with final_score, raw_score, risk_multiplier, score_breakdown, risk_factors.
    """
    must = gap_analysis.get("must_have_analysis", {})
    preferred = gap_analysis.get("preferred_analysis", {})
    exp_req = gap_analysis.get("experience_requirement", {})
    cloud_status = gap_analysis.get("required_cloud_status", {})
    exp_expectations = gap_analysis.get("experience_expectations_analysis", {})
    edu_analysis = gap_analysis.get("education_analysis", {})

    risk_factors: list[str] = []

    # ---------- Extract all inputs ----------
    must_in_exp_list = must.get("found_in_experience") or []
    must_skills_only_list = must.get("found_in_skills_only") or []
    must_missing_list = must.get("missing") or []
    N = max(must.get("total_required") or 0, len(must_in_exp_list) + len(must_skills_only_list) + len(must_missing_list))
    A = len(must_in_exp_list)
    B = len(must_skills_only_list)
    C = len(must_missing_list)
    R = exp_req.get("minimum_years_required") or 0
    Y = exp_req.get("candidate_total_years") or 0
    cloud_required = (cloud_status.get("required") or "").strip()
    cloud_in_experience = cloud_status.get("present_in_experience", True)
    pref_in_exp_list = preferred.get("found_in_experience") or []
    pref_skills_only_list = preferred.get("found_in_skills_only") or []
    pref_missing_list = preferred.get("missing") or []
    pref_exp = len(pref_in_exp_list)
    pref_skills_only = len(pref_skills_only_list)
    pref_missing = len(pref_missing_list)
    total_preferred = pref_exp + pref_skills_only + pref_missing
    depth_matched_list = exp_expectations.get("matched") or []
    depth_unmatched_list = exp_expectations.get("unmatched") or []
    depth_matched = len(depth_matched_list)
    depth_unmatched = len(depth_unmatched_list)
    total_depth = depth_matched + depth_unmatched

    # ---------- Phase scores (S_i ∈ [0,1] per doc Section 3) ----------
    if N == 0:
        experience_ratio = 0.0
        skills_only_ratio = 0.0
        missing_ratio = 0.0
        S_must = 0.0
        must_have_reason = "no must-haves required"
    else:
        experience_ratio = A / N
        skills_only_ratio = B / N
        missing_ratio = C / N
        parts = [f"{A}/{N} must-haves demonstrated in experience"]
        if B > 0:
            parts.append(f"{B} listed in skills only ({', '.join(must_skills_only_list)}), add these to experience bullets")
        if C > 0:
            parts.append(f"{C} missing entirely ({', '.join(must_missing_list)}), critical gap")
        must_have_reason = "; ".join(parts)
        # CoreStrength = (1.0·ExperienceRatio) + (0.7·SkillsOnlyRatio) - (0.3·MissingRatio)
        core_strength = (
            (experience_ratio * 1.0)
            + (skills_only_ratio * 0.7)
            - (missing_ratio * 0.3)
        )
        S_must = max(0.0, min(1.0, core_strength))

    if R == 0:
        meets = exp_req.get("meets_requirement", True)
        S_exp = 1.0 if meets else 0.0
        experience_reason = "no minimum years required" if meets else "does not meet experience requirement"
    else:
        S_exp = min(1.0, Y / R)
        experience_reason = f"{Y} years vs required {R}"

    if cloud_required:
        S_cloud = 1.0 if cloud_in_experience else 0.0
    else:
        S_cloud = 0.0

    if total_preferred > 0:
        preferred_ratio_val = (pref_exp + (0.25 * pref_skills_only)) / total_preferred
        S_preferred = min(1.0, preferred_ratio_val)
    else:
        S_preferred = 0.0

    if total_depth > 0:
        S_depth = depth_matched / total_depth
    else:
        S_depth = 0.0

    # ---------- Education phase ----------
    DEGREE_RANK = {"none": 0, "bachelor": 1, "master": 2, "phd": 3}
    edu_required = (edu_analysis.get("required_degree_level") or "none").lower()
    edu_candidate = (edu_analysis.get("candidate_degree_level") or "none").lower()
    edu_field_match = edu_analysis.get("field_match", True)
    edu_req_satisfied = edu_analysis.get("requirement_satisfied", True)

    if edu_required == "none":
        S_edu = 0.0
        education_reason = "no education requirement specified"
    elif edu_req_satisfied and edu_field_match:
        S_edu = 1.0
        education_reason = f"{edu_candidate} degree meets {edu_required} requirement with matching field"
    elif edu_req_satisfied and not edu_field_match:
        S_edu = 0.7
        education_reason = f"{edu_candidate} degree meets {edu_required} requirement but field does not match preferred fields"
    elif not edu_req_satisfied and DEGREE_RANK.get(edu_candidate, 0) > 0:
        S_edu = 0.3
        education_reason = f"{edu_candidate} degree does not meet {edu_required} requirement"
    else:
        S_edu = 0.0
        education_reason = f"no recognized degree; {edu_required} degree required"

    # ---------- Dynamic Weight Normalization ----------
    W_m, W_e, W_c, W_pref, W_depth, W_edu = 35, 15, 20, 10, 10, 10
    active_must = N > 0
    active_exp = True
    active_cloud = bool(cloud_required)
    active_pref = total_preferred > 0
    active_depth = total_depth > 0
    active_edu = edu_required != "none"

    phase_weights = [
        (active_must, W_m), (active_exp, W_e), (active_cloud, W_c),
        (active_pref, W_pref), (active_depth, W_depth), (active_edu, W_edu),
    ]
    W_active = sum(w for active, w in phase_weights if active)

    if W_active > 0:
        W_m_new = (W_m / W_active * 100) if active_must else 0.0
        W_e_new = (W_e / W_active * 100) if active_exp else 0.0
        W_c_new = (W_c / W_active * 100) if active_cloud else 0.0
        W_pref_new = (W_pref / W_active * 100) if active_pref else 0.0
        W_depth_new = (W_depth / W_active * 100) if active_depth else 0.0
        W_edu_new = (W_edu / W_active * 100) if active_edu else 0.0
    else:
        W_m_new = W_e_new = W_c_new = W_pref_new = W_depth_new = W_edu_new = 0.0

    # Risk factors
    if N > 5 and missing_ratio > 0.6:
        risk_factors.append("missing_60_percent_of_must_have")
    if N > 5 and missing_ratio > 0.4:
        risk_factors.append("missing_40_percent_of_must_have")
    if N > 5 and B > A and (A + B) > 0:
        risk_factors.append("skills_only_heavy")
    if R > 0 and Y < 0.5 * R:
        risk_factors.append("experience_below_50_percent")
    if cloud_required and not cloud_in_experience:
        risk_factors.append("required_cloud_not_in_experience")
    if active_edu and not edu_req_satisfied:
        risk_factors.append("education_requirement_not_met")

    # Reason strings for score_breakdown
    if cloud_required and cloud_in_experience:
        cloud_reason = f"{cloud_required} present in experience"
    elif cloud_required and not cloud_in_experience:
        cloud_reason = f"{cloud_required} is required but not demonstrated in experience, add {cloud_required} projects or usage to experience bullets"
    else:
        cloud_reason = "no specific cloud platform required"

    if total_preferred > 0:
        pref_parts = [f"{pref_exp}/{total_preferred} preferred skills demonstrated in experience"]
        if pref_skills_only > 0:
            pref_parts.append(f"{pref_skills_only} in skills only ({', '.join(pref_skills_only_list)}), weave into experience bullets")
        if pref_missing > 0:
            pref_parts.append(f"{pref_missing} missing ({', '.join(pref_missing_list)})")
        preferred_reason = "; ".join(pref_parts)
    else:
        preferred_reason = "no preferred skills listed in JD"

    if total_depth > 0:
        depth_parts = []
        if depth_matched > 0:
            depth_parts.append(f"demonstrated: {', '.join(depth_matched_list)}")
        if depth_unmatched > 0:
            depth_parts.append(f"not demonstrated: {', '.join(depth_unmatched_list)}, add relevant experience bullets")
        depth_reason = f"{depth_matched}/{total_depth} experience expectations matched; " + "; ".join(depth_parts)
    else:
        depth_reason = "no experience expectations required by JD"


    # RawScore = sum over active (W_i^new * S_i)
    must_have_score = S_must * W_m_new
    experience_score = S_exp * W_e_new
    cloud_score = S_cloud * W_c_new
    preferred_score = S_preferred * W_pref_new
    depth_score = S_depth * W_depth_new
    education_score = S_edu * W_edu_new

    # ---------- Raw Score ----------
    raw_score = (
        must_have_score
        + experience_score
        + cloud_score
        + preferred_score
        + depth_score
        + education_score
    )

    # ---------- Risk Multiplier ----------
    multiplier = 1.0
    if N > 5 and missing_ratio > 0.4:
        multiplier *= 0.6
    if N > 5 and missing_ratio > 0.6:
        multiplier *= 0.4
    if R > 0 and Y < 0.5 * R:
        multiplier *= 0.5
    if N > 0 and experience_ratio < 0.3:
        multiplier *= 0.5
    if N > 5 and B > A and (A + B) > 0:
        multiplier *= 0.7

    # ---------- Final Score ----------
    final_score_float = raw_score * multiplier
    final_score = round(max(0.0, min(100.0, final_score_float)))

    return {
        "final_score": final_score,
        "raw_score": round(raw_score, 2),
        "risk_multiplier": round(multiplier, 2),
        "normalized_weights": {
            "must_have": round(W_m_new, 2),
            "experience_years": round(W_e_new, 2),
            "cloud": round(W_c_new, 2),
            "preferred": round(W_pref_new, 2),
            "experience_depth": round(W_depth_new, 2),
            "education": round(W_edu_new, 2),
        },
        "phase_scores": {
            "must_have": round(S_must, 2),
            "experience_years": round(S_exp, 2),
            "cloud": round(S_cloud, 2),
            "preferred": round(S_preferred, 2),
            "experience_depth": round(S_depth, 2),
            "education": round(S_edu, 2),
        },
        "score_breakdown": {
            "must_have": {
                "score": round(must_have_score, 2),
                "reason": must_have_reason,
            },
            "experience_years": {
                "score": round(experience_score, 2),
                "reason": experience_reason,
            },
            "cloud": {
                "score": round(cloud_score, 2),
                "reason": cloud_reason,
            },
            "preferred": {
                "score": round(preferred_score, 2),
                "reason": preferred_reason,
            },
            "experience_depth": {
                "score": round(depth_score, 2),
                "reason": depth_reason,
            },
            "education": {
                "score": round(education_score, 2),
                "reason": education_reason,
            },
        },
        "risk_factors": risk_factors,
    }
