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

## 通用工作约束

- 当前任务优先，不要每次重新分析整个项目。
- 开始工作时先读取适用的 `AGENTS.md` 和当前任务直接相关的文档，只读取必要范围。
- 若已有上一阶段交接摘要，先以摘要为入口；只有发现矛盾、信息过期或缺少证据时，才回查对应源码。
- 只检查当前任务涉及的源码、调用链和测试文件，必要时再扩大检查范围。
- 不重复阅读、总结或输出已经确认且没有变化的内容。
- 不主动扫描无关模块，不为了全面而全面。
- 不擅自扩大任务范围；发现范围外问题时，只做简要记录。
- 一个任务完成后，输出简短交接摘要，供其他 Codex 对话使用。
- 完成报告只保留修改文件、关键实现、测试证据、遗留问题和 Git 状态。
- 简单任务采用适度推理；复杂安全和架构任务保留充分分析。
- 不得为了节省 Token 而省略必要的安全检查、测试和验收。
