"""Deterministic LaTeX generation from structured resume JSON."""
import re
from pathlib import Path

from config import ROOT_DIR

_MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

_LATEX_SPECIAL = {
    "\\": r"\textbackslash{}",
    "{": r"\{",
    "}": r"\}",
    "#": r"\#",
    "$": r"\$",
    "%": r"\%",
    "&": r"\&",
    "_": r"\_",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}

_ESCAPE_RE = re.compile(r"[\\{}#$%&_~^]")


def escape_latex(text: str) -> str:
    """Escape LaTeX special characters in display text."""
    if not text:
        return ""
    return _ESCAPE_RE.sub(lambda m: _LATEX_SPECIAL[m.group()], str(text))


def _safe(val, fallback: str = "") -> str:
    """Return escaped string or fallback if falsy."""
    return escape_latex(str(val)) if val else fallback


def _format_date(date_str: str) -> str:
    """Convert YYYY-MM or YYYY to 'Mon, YYYY' or 'YYYY'. Pass through 'Present'."""
    if not date_str:
        return ""
    if date_str.lower() == "present":
        return "Present"
    parts = date_str.split("-")
    if len(parts) >= 2:
        year, month = parts[0], parts[1]
        try:
            idx = int(month) - 1
            if 0 <= idx < 12:
                return f"{_MONTH_NAMES[idx]}, {year}"
        except ValueError:
            pass
        return year
    return date_str


def _date_range(item: dict) -> str:
    start = _format_date(item.get("start_date", ""))
    end = _format_date(item.get("end_date", ""))
    if start and end:
        return f"{start} - {end}"
    return start or end


def _replace_placeholders(template: str, replacements: dict[str, str]) -> str:
    """Replace <<PLACEHOLDER>> tokens in template with values."""
    result = template
    for key, value in replacements.items():
        result = result.replace(f"<<{key}>>", value)
    return result


# ── 1-page section renderers (article class) ────────────────────


def _build_links_inline(basics: dict, separator: str = r" \textbar{} ") -> str:
    links = basics.get("links", [])
    parts = []
    for link in links:
        url = link.get("url", "")
        label = link.get("label", "") or url
        if url:
            parts.append(rf"\href{{{url}}}{{{_safe(label)}}}")
    return separator.join(parts)


def _basics_replacements(basics: dict, links_inline: str) -> dict[str, str]:
    return {
        "BASICS_NAME": _safe(basics.get("name")),
        "BASICS_PHONE": _safe(basics.get("phone")),
        "BASICS_EMAIL_URL": basics.get("email", ""),
        "BASICS_EMAIL": _safe(basics.get("email")),
        "BASICS_LINKS_INLINE": links_inline,
    }


def _render_heading(template: str, basics: dict) -> str:
    links_inline = _build_links_inline(basics, r" \textbar{} ")
    return _replace_placeholders(template, _basics_replacements(basics, links_inline))


def _render_skills(template: str, skills: dict) -> str:
    categories = skills.get("categories", [])
    lines = []
    for cat in categories:
        name = _safe(cat.get("name", ""))
        raw_items = cat.get("items", [])
        items_list = [i for i in raw_items if str(i).strip()]
        if not name and not items_list:
            # Skip empty placeholder categories
            continue
        items = ", ".join(_safe(i) for i in items_list)
        lines.append(rf"\item{{ \textbf{{{name}:}} {items} }}")
    return _replace_placeholders(template, {
        "TECHNICAL_SKILLS_ITEMS": "\n".join(lines),
    })


def _render_experience_item(item: dict) -> str:
    company = _safe(item.get("company", ""))
    title = _safe(item.get("title", ""))
    exp_title = f"{company} - {title}" if company else title
    dates = _date_range(item)

    highlights = item.get("highlights", [])
    hl_lines = "\n".join(f"      \\item {_safe(h)}" for h in highlights)

    lines = [
        "",
        "%=== BEGIN_EXPERIENCE_ITEM ===",
        "  \\resumeSubheading",
        f"    {{{exp_title}}}{{\\textit{{{dates}}}}}",
        "    {}{}",
        "    \\vspace{-0.34cm}",
        "    \\resumeItemListStart",
        hl_lines,
        "    \\resumeItemListEnd",
        "%=== END_EXPERIENCE_ITEM ===",
    ]
    return "\n".join(lines)


def _render_experience(template: str, experience: dict) -> str:
    items = experience.get("items", [])
    rendered = "\n".join(_render_experience_item(item) for item in items)
    return _replace_placeholders(template, {"EXPERIENCE_ITEMS": rendered})


def _render_project_item(item: dict) -> str:
    name = _safe(item.get("name", ""))
    tech = item.get("tech_stack") or item.get("technologies") or []
    tech_inline = rf"\textit{{{', '.join(_safe(t) for t in tech)}}}" if tech else ""

    highlights = item.get("highlights", [])
    hl_lines = "\n".join(f"  \\item {_safe(h)}" for h in highlights)

    lines = [
        "",
        "%=== BEGIN_PROJECT_ITEM ===",
        rf"\resumeProjectHeading{{{name}}}{{{tech_inline}}}",
        r"\resumeItemListStart",
        hl_lines,
        r"\resumeItemListEnd",
        "%=== END_PROJECT_ITEM ===",
    ]
    return "\n".join(lines)


def _render_projects(template: str, projects: dict) -> str:
    items = projects.get("items", [])
    rendered = "\n".join(_render_project_item(item) for item in items)
    return _replace_placeholders(template, {"PROJECT_ITEMS": rendered})


def _render_publications(template: str, publications: dict) -> str:
    items = publications.get("items", [])
    lines = []
    for pub in items:
        pub = pub or {}
        title_raw = pub.get("title", "")
        if not str(title_raw).strip():
            # Skip placeholder/empty publications
            continue
        title = _safe(title_raw)
        venue = _safe(pub.get("publisher_or_venue", ""))
        date = _format_date(pub.get("date", ""))
        topics = pub.get("topics", [])
        link = pub.get("link", "")

        topics_str = ""
        if topics:
            topics_str = rf" {{\textit{{{', '.join(_safe(t) for t in topics)}}}}}"

        venue_date = ""
        if venue and date:
            venue_date = rf" \textbar{{}} {{\em{{\textbf{{{venue}}}, {date}}}}}"
        elif venue:
            venue_date = rf" \textbar{{}} {{\em{{\textbf{{{venue}}}}}}}"
        elif date:
            venue_date = rf" \textbar{{}} {{\em{{{date}}}}}"

        link_str = ""
        if link:
            link_str = rf" \textbar{{}} \href{{{link}}}{{\raisebox{{-0.2\height}}\ \underline{{Link}}}}"

        lines.append(rf"\item {title}{topics_str}{venue_date}{link_str}")

    return _replace_placeholders(template, {
        "PUBLICATIONS_ITEMS": "\n".join(lines),
    })


def _render_education_item(item: dict) -> str:
    institution = _safe(item.get("institution", ""))
    degree = _safe(item.get("degree", ""))
    dates = _date_range(item)

    gpa = item.get("gpa", {})
    gpa_inline = ""
    if isinstance(gpa, dict) and gpa.get("value") and gpa.get("scale"):
        gpa_inline = rf"CGPA: \textbf{{{gpa['value']}/{gpa['scale']}}}"

    coursework = item.get("coursework") or item.get("course_works") or []
    cw_inline = ", ".join(_safe(c) for c in coursework)

    lines = [
        "",
        "%=== BEGIN_EDUCATION_ITEM ===",
        "  \\resumeSubheading",
        f"    {{{institution}}}{{\\textit{{{dates}}}}}",
        f"    {{{degree}}}{{{gpa_inline}}}",
    ]

    if cw_inline:
        lines.append("")
        lines.append(f"    \\textbf{{Coursework:}} {cw_inline}")

    lines.append("%=== END_EDUCATION_ITEM ===")
    return "\n".join(lines)


def _render_education(template: str, education: dict) -> str:
    items = education.get("items") or education.get("degrees") or []
    rendered = "\n".join(_render_education_item(item) for item in items)
    return _replace_placeholders(template, {"EDUCATION_ITEMS": rendered})


# ── 2-page section renderers (resume document class) ────────────


def _render_2page_heading(template: str, basics: dict) -> str:
    links_inline = _build_links_inline(basics, r" \\ ")
    return _replace_placeholders(template, _basics_replacements(basics, links_inline))


def _render_2page_skills(template: str, skills: dict) -> str:
    categories = skills.get("categories", [])
    lines = []
    for cat in categories:
        name = _safe(cat.get("name", ""))
        raw_items = cat.get("items", [])
        items_list = [i for i in raw_items if str(i).strip()]
        if not name and not items_list:
            # Skip empty placeholder categories
            continue
        items = ", ".join(_safe(i) for i in items_list)
        lines.append(f"{name} & {items} \\\\")
    return _replace_placeholders(template, {
        "TECHNICAL_SKILLS_ITEMS": "\n".join(lines),
    })


def _render_2page_experience_item(item: dict) -> str:
    company = _safe(item.get("company", ""))
    title = _safe(item.get("title", ""))
    exp_title = f"{company} - {title}" if company else title
    dates = _date_range(item)

    highlights = item.get("highlights", [])
    hl_lines = "\n".join(f"\\item {_safe(h)}" for h in highlights)

    lines = [
        "",
        rf"\begin{{rSubsection}}{{{exp_title}}}{{{dates}}}{{}}{{}}",
        hl_lines,
        r"\end{rSubsection}",
    ]
    return "\n".join(lines)


def _render_2page_experience(template: str, experience: dict) -> str:
    items = experience.get("items", [])
    rendered = "\n".join(_render_2page_experience_item(item) for item in items)
    return _replace_placeholders(template, {"EXPERIENCE_ITEMS": rendered})


def _render_2page_project_item(item: dict) -> str:
    name = _safe(item.get("name", ""))
    tech = item.get("tech_stack") or item.get("technologies") or []
    tech_inline = ", ".join(_safe(t) for t in tech) if tech else ""

    highlights = item.get("highlights", [])
    hl_lines = "\n".join(f"\\item {_safe(h)}" for h in highlights)

    lines = [
        rf"\begin{{rSubsection}} {{{name}}} {{{tech_inline}}}{{}}{{}}",
        hl_lines,
        r"\end{rSubsection}",
    ]
    return "\n".join(lines)


def _render_2page_projects(template: str, projects: dict) -> str:
    items = projects.get("items", [])
    rendered = "\n".join(_render_2page_project_item(item) for item in items)
    return _replace_placeholders(template, {"PROJECT_ITEMS": rendered})


def _render_2page_publications(template: str, publications: dict) -> str:
    items = publications.get("items", [])
    lines = []
    for pub in items:
        pub = pub or {}
        title_raw = pub.get("title", "")
        if not str(title_raw).strip():
            # Skip placeholder/empty publications
            continue
        title = _safe(title_raw)
        venue = _safe(pub.get("publisher_or_venue", ""))
        date = _format_date(pub.get("date", ""))
        link = pub.get("link", "")

        venue_date = ""
        if venue and date:
            venue_date = rf" - {{\em {venue}, {date}}}"
        elif venue:
            venue_date = rf" - {{\em {venue}}}"
        elif date:
            venue_date = rf" - {{\em {date}}}"

        link_str = ""
        if link:
            link_str = rf" \href{{{link}}}{{\raisebox{{-0.2\height}}\ \underline{{Link}}}}"

        lines.append(rf"\textbf{{{title}}}{venue_date}{link_str}")

    return _replace_placeholders(template, {
        "PUBLICATIONS_ITEMS": "\n".join(lines),
    })


def _render_2page_education_item(item: dict) -> str:
    institution = _safe(item.get("institution", ""))
    degree = _safe(item.get("degree", ""))
    dates = _date_range(item)

    gpa = item.get("gpa", {})
    gpa_inline = ""
    if isinstance(gpa, dict) and gpa.get("value") and gpa.get("scale"):
        gpa_inline = rf" \hfill {{CGPA: \textbf{{{gpa['value']}/{gpa['scale']}}} }}"

    coursework = item.get("coursework") or item.get("course_works") or []

    lines = [
        rf"{{\bfseries {institution}}} \hfill {{\em {dates}}}",
        rf"\\ {degree}.{gpa_inline}",
    ]

    if coursework:
        cw_inline = ", ".join(_safe(c) for c in coursework)
        lines.append(rf"\\ \textbf{{Coursework:}} {cw_inline}")

    return "\n".join(lines)


def _render_2page_education(template: str, education: dict) -> str:
    items = education.get("items") or education.get("degrees") or []
    rendered_items = [_render_2page_education_item(item) for item in items]
    rendered = "\\\\\n".join(rendered_items)
    return _replace_placeholders(template, {"EDUCATION_ITEMS": rendered})


# ── Section ordering & conditional inclusion ─────────────────────

_SECTION_REGISTRY_1PAGE = [
    {
        "file": "section_heading.tex",
        "always": True,
        "data_key": "basics",
        "renderer": _render_heading,
    },
    {
        "file": "section_skills.tex",
        "data_path": ("sections", "technical_skills"),
        "check_field": "categories",
        "renderer": _render_skills,
    },
    {
        "file": "section_experience.tex",
        "data_path": ("sections", "experience"),
        "check_field": "items",
        "renderer": _render_experience,
    },
    {
        "file": "section_projects.tex",
        "data_path": ("sections", "projects"),
        "check_field": "items",
        "renderer": _render_projects,
    },
    {
        "file": "section_publications.tex",
        "data_path": ("sections", "publications"),
        "check_field": "items",
        "renderer": _render_publications,
    },
    {
        "file": "section_education.tex",
        "data_path": ("sections", "education"),
        "check_field": "_education",
        "renderer": _render_education,
    },
]

_SECTION_REGISTRY_2PAGE = [
    {
        "file": "section_heading.tex",
        "always": True,
        "data_key": "basics",
        "renderer": _render_2page_heading,
    },
    {
        "file": "section_education.tex",
        "data_path": ("sections", "education"),
        "check_field": "_education",
        "renderer": _render_2page_education,
    },
    {
        "file": "section_skills.tex",
        "data_path": ("sections", "technical_skills"),
        "check_field": "categories",
        "renderer": _render_2page_skills,
    },
    {
        "file": "section_experience.tex",
        "data_path": ("sections", "experience"),
        "check_field": "items",
        "renderer": _render_2page_experience,
    },
    {
        "file": "section_projects.tex",
        "data_path": ("sections", "projects"),
        "check_field": "items",
        "renderer": _render_2page_projects,
    },
    {
        "file": "section_publications.tex",
        "data_path": ("sections", "publications"),
        "check_field": "items",
        "renderer": _render_2page_publications,
    },
]

_TEMPLATE_REGISTRIES = {
    "1page": _SECTION_REGISTRY_1PAGE,
    "2page": _SECTION_REGISTRY_2PAGE,
}

AVAILABLE_TEMPLATES = ["1page", "2page"]


def _get_nested(d: dict, path: tuple):
    for key in path:
        if not isinstance(d, dict):
            return {}
        d = d.get(key, {})
    return d


def _section_has_data(section_data: dict, check_field: str) -> bool:
    if check_field == "_education":
        items = section_data.get("items") or section_data.get("degrees") or []
        if not isinstance(items, list):
            return False
        return any(
            isinstance(entry, dict)
            and any(str(v).strip() for v in entry.values())
            for entry in items
        )

    value = section_data.get(check_field)
    if isinstance(value, list):
        # Treat list-of-empty-objects or empty strings as empty
        return any(
            (
                isinstance(entry, dict)
                and any(str(v).strip() for v in entry.values())
            )
            or (not isinstance(entry, dict) and str(entry).strip())
            for entry in value
        )
    return bool(value)


def generate_latex(
    resume_json: dict,
    template_name: str = "1page",
    templates_dir: Path | None = None,
) -> str:
    templates_dir = templates_dir or (ROOT_DIR / "resources" / "templates")

    if template_name not in AVAILABLE_TEMPLATES:
        template_name = "1page"

    template_dir = templates_dir / template_name
    resume = resume_json.get("resume", resume_json)
    registry = _TEMPLATE_REGISTRIES.get(template_name, _SECTION_REGISTRY_1PAGE)

    parts: list[str] = []

    parts.append((template_dir / "header.tex").read_text())

    for section in registry:
        section_file = template_dir / section["file"]
        if not section_file.exists():
            continue

        section_template = section_file.read_text()

        if section.get("always"):
            data_key = section.get("data_key", "")
            parts.append(section["renderer"](section_template, resume.get(data_key, {})))
            continue

        data_path = section.get("data_path")
        if not data_path:
            continue

        section_data = _get_nested(resume, data_path)
        if not isinstance(section_data, dict):
            continue

        if not _section_has_data(section_data, section.get("check_field", "")):
            continue

        parts.append(section["renderer"](section_template, section_data))

    parts.append((template_dir / "footer.tex").read_text())

    return "".join(parts)
