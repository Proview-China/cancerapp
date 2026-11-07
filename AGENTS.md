<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## Project Development Rules

- Read the relevant code and OpenSpec requirements before making changes. Reuse the existing code and technology stack where practical; obtain approval before large-scale refactoring or replacing technologies.
- Keep responsibilities clear: clients handle interaction and presentation; the Express backend owns business APIs and coordinates data and file access; PostgreSQL stores structured data. Python in `ai/` currently contains experiments, and any future inference service and its integration require an approved design.
- Follow the conventions of the affected module. Keep changes scoped, add appropriate tests for behavioral changes, and run relevant available checks. Report checks not run and their reasons.
- Clearly distinguish demo data, simulated outputs, experimental results, and actual model inference. Do not present unverified results as model performance or clinical conclusions. Protect patient information and secrets.
- Follow the existing OpenSpec workflow for new capabilities, breaking changes, and architectural changes; obtain proposal approval before implementation. Apply the exceptions documented in `openspec/AGENTS.md` where appropriate.
