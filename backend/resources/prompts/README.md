# Prompts Directory

This directory contains all the prompts used for LLM interactions. Prompts are separated into system and user prompts for better organization and easier updates.

## Structure

### Evaluation Prompts

- `evaluation_system_standard.txt` - System prompt for resume evaluation (standard formatting)
- `evaluation_system_star.txt` - System prompt for resume evaluation (star formatting)
- `evaluation_system_metrics_heavy.txt` - System prompt for resume evaluation (metrics-heavy formatting)
- `evaluation_user.txt` - User prompt template for resume evaluation (shared across all formatting preferences)

### LaTeX Generation Prompts

- `fill_latex_system.txt` - System prompt for filling LaTeX template
- `fill_latex_user.txt` - User prompt template for filling LaTeX template

### LaTeX Improvement Prompts

- `latex_improve_system.txt` - System prompt for improving LaTeX resumes
- `latex_improve_user.txt` - User prompt template for improving LaTeX resumes

## How to Update Prompts

1. Edit the corresponding `.txt` file directly
2. Use Python string formatting with `{variable_name}` for dynamic content
3. The `prompt_loader.py` module handles loading and formatting these prompts
4. Changes take effect immediately (prompts are cached but can be reloaded by restarting the server)

## Variables

### Evaluation Prompts

- `{target_role}` - The target job role
- `{formatting_pref}` - Formatting preference (standard, star, metrics-heavy)
- `{resume_text}` - The resume content
- `{job_description}` - The job description

**Note**: Different formatting preferences use different system prompt files:

- `standard` → `evaluation_system_standard.txt`
- `star` → `evaluation_system_star.txt`
- `metrics-heavy` → `evaluation_system_metrics_heavy.txt`

### LaTeX Fill Prompts

- `{latex_template}` - The predefined LaTeX template (loaded from templates/)
- `{resume_content}` - The resume content to fill into template
- `{target_role}` - The target job role

### LaTeX Improve Prompts

- `{latex_code}` - The LaTeX code to improve
- `{job_description}` - The job description
- `{target_role}` - The target job role
- `{formatting_pref}` - Formatting preference
- `{improvements_text}` - Optional list of specific improvements
