# Project Context

## Purpose and Status

CancerApp currently provides case and medical image management, displays stored tissue analysis data, and includes desktop AI text chat and separate image-processing experiments. Its longer-term goal is an immunohistochemistry pathology image analysis system. Planned capabilities are not evidence of implemented or clinically validated functionality.

## Current Technology Stack

- Desktop: React 19, TypeScript 5, Vite 7, Electron 33, ECharts, and plain CSS in `frontend/`.
- Mobile web: React 19, React Router, TypeScript, and Vite in `frontend-mobile/`.
- WeChat miniapp: Taro 4, React 18, TypeScript, and SCSS in `wechatapp/`.
- Backend: Node.js, TypeScript, Express 4, Multer, `pg`, CORS, and dotenv in `backend/`.
- Database and storage: PostgreSQL with a local filesystem upload directory; the initial schema is in `database/schema.sql`.
- Image experiments: Python scripts using OpenCV, NumPy, and Matplotlib, with experimental Cellpose and StarDist calls in `ai/`. No Python dependency lockfile was found.
- Website: standalone HTML, CSS, JavaScript, and assets in `website/`.

## Current Architecture

### Implemented Code

- `frontend/src/App.tsx` and `frontend/src/components/` provide the desktop UI. Client services in `frontend/src/services/` call the backend. Electron exposes selected window and file operations through `frontend/electron/preload.cjs`.
- `backend/src/server.ts` mounts `/cases`, `/ai`, `/uploads`, and `/health`. Case routes manage cases, samples, reports, ordering, and stored tissue analysis. Files are stored locally and served under `/uploads`.
- The desktop chat uses `/ai/config` and `/ai/chat` to configure and call an external OpenAI-compatible chat endpoint, defaulting to DeepSeek settings. This is text chat, not pathology image inference.
- The mobile web client reads cases and analysis through backend APIs. Its AI replies are demo responses.
- The miniapp defaults to bundled demo data and has a configurable API mode. Its chat replies are examples. Its real-mode case detail client requests `GET /cases/:caseId`, for which no matching backend route was found; integration requires verification and correction in a separate change.
- The website is a separate static site; a business API integration was not found in the inspected code.

### Experiments and Demo Data

- `ai/scripts/` includes image splitting, OpenCV detection, and scripts that attempt pretrained Cellpose and StarDist inference. These scripts are not connected to the case API; their execution and results have not been verified here.
- `ai/demo_pipeline.py` contains simulated detection and segmentation and fixed example output. It is not a trained or integrated image analysis model.
- Existing analysis records, example predictions, and visualizations may use demo inputs or fallback values. Their origin must remain distinguishable from actual inference; they are not evidence of clinical validity.
- `uploads/` contains example files. Some demo seed scripts reference a root `demo_fake/` directory that is absent in the current checkout; the availability and provenance of other source data must be verified before use.

## Data and Storage

- The case workflow uses `cases`, `case_samples`, `case_reports`, and `sample_tissue_analysis`. Cases use a unique `identifier`; supported sample modalities are tissue, CT, and MRI.
- The schema also defines dataset, sample, label, attribute, source, and version tables. A complete dataset management workflow was not found in the inspected application code.
- Files are saved beneath `UPLOADS_ROOT`, which defaults to the repository's `uploads/` directory when the backend is launched from `backend/`. Paths and runtime configuration must be checked for other working directories and packaged deployments.
- The schema initializes tables and triggers; `backend/src/db/init.ts` also performs some runtime table and column checks. Schema changes should consider existing data, migrations, and required permissions.
- The current server exposes uploads as static files and does not implement user authentication. Treat it as unsuitable for exposing sensitive case data to untrusted networks without further security work.

## Project Conventions

- Prefer existing module patterns and scoped changes. TypeScript strict mode is enabled in the desktop, backend, and miniapp configurations.
- Backend TypeScript uses NodeNext/ES modules with `.js` import specifiers; Electron main and preload scripts use CommonJS. The miniapp has its own configuration and package setup.
- Use the existing service layers, components, route handlers, and types where applicable. Preserve API and data contracts unless an approved OpenSpec change explicitly updates them.
- Respect demo versus real data provenance. Do not treat heuristic visualizations, example predictions, or external text chat as validated pathology analysis.
- Protect case data and credentials in code, logs, files, and external requests. Current security controls and data provenance should be verified before handling real patient data.

## Tests and Verification

- `backend/tests/cases.textReports.test.ts` contains Vitest, Supertest, and `pg-mem` tests for text-only case creation, validation, and report CRUD. Run `npm test` from `backend/` when dependencies are available; current pass status is unverified.
- Backend build: `npm run build` from `backend/`. Desktop checks: `npm run build` and `npm run lint` from `frontend/`.
- Mobile web build: `npm run build` from `frontend-mobile/`. Miniapp checks: `npm run build:weapp` and `npm run lint` from `wechatapp/`.
- Electron and Python files with test-like names include manual or experimental scripts; they should not be assumed to be automated regression coverage. Image upload, AI gateway, integrated model inference, and cross-client workflows need additional verification appropriate to changes.
- Builds and tests may create artifacts. Seed scripts write database records and files; do not run them against an unapproved environment. Report which checks were run and any limitations.

## Future Direction and Constraints

- The planned scope includes user and access management, pathology image management, cell detection and positivity classification, quantitative analysis, visualization and report export, and medical literature collection and management.
- A Python image inference service, training and evaluation pipeline, model and data versioning, and integration with the business backend are future design options, not existing services. Model family, architecture, framework, data, and deployment approach remain to be decided through data review and experiments.
- Establish image and annotation provenance, labeling rules, patient or slide-level data splits, and evaluation methods before claiming model performance. Record the model, inputs, parameters, and result provenance when real inference is implemented.
- Follow `openspec/AGENTS.md`: proposals for new capabilities, breaking changes, and architectural changes must be reviewed and approved before implementation. Existing specs are requirements to inspect, not proof that every scenario currently works; investigate conflicts or implementation gaps before changing behavior.
- Prefer incremental extension of existing components. Avoid unapproved broad refactors or technology replacement. Future database, file-storage, security, and API changes must consider compatibility and existing data.

## Existing Workflow and Dependencies

- The documented Git conventions use `feature/*`, `fix/*`, or `chore/*` branches and Conventional Commits.
- The backend needs PostgreSQL and local filesystem access. The desktop development environment uses Vite and Electron; the miniapp uses Taro and WeChat developer tooling. Backend documentation recommends Node.js 20+; actual compatibility of each module and packaged distribution should be verified in its target environment.
- Backend API location is configured by `VITE_API_BASE_URL` for the web clients and `WECHATAPP_API_BASE` for the miniapp. See the module READMEs and package scripts for setup details.
