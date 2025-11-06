# Project Context

## Purpose
CancerApp is a desktop-style application for managing oncology case records and their associated imaging samples (e.g., tissue slides, CT, MRI). Users can import images, preview them, organize by case, and curate datasets for downstream analysis. The app runs a React + Electron UI and an Express + PostgreSQL backend that persists cases and stores uploaded files locally.

## Tech Stack
- Frontend: React 19, TypeScript 5, Vite 7, Electron 33 (custom preload bridge), ESLint 9
- Backend: Node.js (ES modules), TypeScript 5, Express 4, Multer (uploads), pg (PostgreSQL), CORS, dotenv
- Database: PostgreSQL (UUIDs, citext, JSONB; schema in `database/schema.sql`)
- Packaging/Dev: Vite dev server, Electron Builder for desktop packaging, `tsx` for TS runtime

## Project Conventions

### Code Style
- TypeScript strict mode enabled across frontend and backend
- ESM everywhere; TS source imports use `.js` extensions to match ESM output
- Frontend linting with `frontend/eslint.config.js`; no Prettier configured at repo level
- Naming: camelCase for variables/functions; PascalCase for React components and types
- UI styles via plain CSS files in `frontend/src` (e.g., `App.css`, `CasesWorkspace.css`)

### Architecture Patterns
- Frontend
  - App shell: `frontend/src/App.tsx`; entry in `frontend/src/main.tsx`
  - Service layer for API calls (`frontend/src/services/caseService.ts`), typed by `frontend/src/types/*`
  - Electron bridge exposed via `window.electronAPI` from `frontend/electron/preload.cjs`
  - Components organized under `frontend/src/components/`
- Backend
  - Express app in `backend/src/server.ts` with routers under `backend/src/routes/`
  - Configuration via `backend/src/config.ts` (env: `PORT`, `DATABASE_URL`, `UPLOADS_ROOT`)
  - Database pool in `backend/src/db/pool.ts`
  - File storage utilities in `backend/src/utils/fileStorage.ts`; static `/uploads` served publicly
  - Case management routes in `backend/src/routes/cases.ts` (list/create/delete)
- Data Model
  - Active tables: `cases`, `case_samples`
  - Additional dataset tables exist for future curation: `datasets`, `samples`, `sample_*`

### Testing Strategy
- Current: manual testing via UI and HTTP calls; no automated tests present
- Near-term (recommended):
  - Backend: Jest/Vitest + Supertest for API routes in `backend/src/routes`
  - Frontend: React Testing Library for key components and service layer
  - Optional E2E: Playwright targeting Electron boot with Vite

### Git Workflow
- Branching: `feature/*`, `fix/*`, `chore/*`
- Commits: Conventional Commits (e.g., `feat: add case editing`)
- PRs: short-lived branches; require passing validation (lint/build) before merge

## Domain Context
- Case: uniquely identified by `identifier` (citext, unique); human-friendly name optional
- Sample: image associated to a case; supported modalities include `组织切片` (tissue), `CT片`, `核磁共振片`
- Import: files uploaded via UI or Electron file dialog; server stores to `/uploads` and returns public URLs
- Display: current UI renders image URLs directly; DICOM (`.dcm`) preview requires future handling
- Dataset curation: schema includes dataset/version/labels for future ML workflows, but UI currently focuses on cases + samples

## Important Constraints
- Upload constraints: max 200MB per file, up to 20 files per request; allowed modalities enforced on server
- Case `identifier` must be unique; current POST route upserts by identifier
- Storage: uploads saved to local filesystem and served from `/uploads`; deleting cases/samples should remove files
- Environment: desktop-first (Electron); API base configured via `VITE_API_BASE_URL` (defaults to `http://localhost:4000`)
- Security/Privacy: no authentication; intended for local, single-user workflows; avoid PHI in shared builds
- Internationalization: current labels and UI copy primarily in Chinese

## External Dependencies
- PostgreSQL instance reachable by `DATABASE_URL`
- Local filesystem for uploads directory (default `uploads/` at repo root)
- Electron runtime for desktop packaging and IPC bridge
- Node.js 20+ recommended for ESM and tooling parity
