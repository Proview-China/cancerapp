## Overview

This design document refines the proposal for `refactor-backend-multi-client-bff` and explains how the backend for cases SHOULD evolve to support multiple client types (desktop, mobile web, WeChat miniapp) while keeping the core business logic and data access shared and evolvable.

The intent is to:

- Introduce a **multi-client BFF layer** (desktop/mobile) that exposes API views tailored to each client without duplicating business rules.
- Introduce a **layered backend architecture** for cases:
  - BFF (HTTP boundary and view shaping)
  - Service (case domain logic)
  - Repository (data access)
  - Database (PostgreSQL + filesystem)
- Make PostgreSQL the **single source of truth** for cases, samples, text reports, and tissue analysis, with demo data only seeded into the DB.
- Prepare for future schema evolution by isolating table/column details behind repository interfaces.

This change is purely about OpenSpec changes (proposal, design, tasks, spec deltas) and does **not** modify any runtime code.

## Current State (Conceptual)

### Routes and Backend

- `backend/src/server.ts`:
  - Creates an Express app, configures CORS and JSON parsing.
  - Serves `/uploads` as static files.
  - Mounts `/cases` using `casesRouter`.
- `backend/src/routes/cases.ts`:
  - Implements:
    - `GET /cases`: list cases with samples & text reports, enrich tissue samples with analysis.
    - `POST /cases`: create or update a case (UPSERT by identifier), upload samples, attach text reports.
    - `DELETE /cases/:caseId`: delete a case and associated sample files.
    - `PATCH /cases/:caseId`: update case display name.
    - `PATCH /cases/:caseId/samples/:sampleId`: update sample description/modality.
    - `DELETE /cases/:caseId/samples/:sampleId`: delete a sample and its file.
    - `GET /cases/:caseId/samples/:sampleId/analysis`: fetch tissue analysis if modality is tissue.
    - `GET/POST/PATCH/DELETE /cases/:caseId/reports[...]`: text report CRUD.
  - Contains:
    - HTTP concerns (status codes, JSON shapes).
    - Business rules (validation, UPSERT behaviour, modality constraints).
    - Direct SQL via `pool.query` to `cases`, `case_samples`, `case_reports`, `sample_tissue_analysis`.
    - File handling via `storeFile`, `deleteStoredFile`.
- Database:
  - Uses PostgreSQL with at least:
    - `cases`
    - `case_samples`
    - `sample_tissue_analysis`
    - `case_reports`
  - Demo data is partially seeded and partially handled via fake/demo code paths.

### Specs

- `cases` spec:
  - Defines text report storage and management.
  - Defines that `GET /cases` returns `reports: CaseReport[]`.
  - Defines case sample analysis association for tissue samples.
- `analysis` spec:
  - Defines the `TissueAnalysis` model (raw, derived, images, metadata) and API contract.
- `ui` and `mobile-ui` specs:
  - Describe frontend behaviour but do not yet distinguish dedicated desktop/mobile API prefixes for cases.

## Target Architecture

### Layered Backend

For case-related features, the backend SHOULD adopt the following layered architecture:

1. **BFF Layer (Desktop/Mobile Routers)**
   - Responsibilities:
     - Parse HTTP requests (path params, query, body).
     - Invoke Service layer operations.
     - Shape the response into JSON views that match desktop or mobile needs.
   - Constraints:
     - MUST NOT construct raw SQL or access `pg` directly.
     - SHOULD NOT implement domain rules beyond minimal mapping and error translation.

2. **Service Layer (Case Domain Logic)**
   - Responsibilities:
     - Implement business operations around cases, samples, text reports, and tissue analysis.
     - Enforce domain invariants (e.g., identifiers, valid modality, length constraints).
     - Coordinate multi-table updates and file operations with transactional consistency.
   - Constraints:
     - MUST NOT directly use `pool.query`.
     - MUST access the database only via Repository interfaces.
     - MUST treat database schema details as implementation details of repositories.

3. **Repository Layer (Data Access)**
   - Responsibilities:
     - Encapsulate all read/write access to `cases`, `case_samples`, `case_reports`, `sample_tissue_analysis` and related tables.
     - Provide methods that expose **business-level data structures** (e.g., `CaseWithRelations`) by joining/aggregating multiple tables.
   - Constraints:
     - MUST be the only layer that interacts with PostgreSQL directly.
     - MUST hide table/column details and SQL from Service and BFF layers.

4. **Database and Filesystem**
   - Responsibilities:
     - Persist all case-related data and files.
     - Serve as the single source of truth for case, sample, text report, and tissue analysis data.
   - Demo data:
     - Seeded into the DB via scripts; not returned from hard-coded runtime JSON.

### Multi-client BFF Interfaces

#### Desktop BFF

Desktop BFF exposes endpoints under `/desktop` and is intended for the Electron-based UI.

Key endpoints:

- `GET /desktop/cases`
  - Returns a list of cases where each item is equivalent in structure to the current `GET /cases` `CaseWithRelations`:
    - Case record.
    - Associated samples (with modality, description, storage paths, thumbnails, timestamps).
    - Associated text reports (title, summary, content, tags, metadata, timestamps).
    - For tissue samples, associated `analysis` data as defined in the `analysis` spec.
- `GET /desktop/cases/{caseId}`
  - Returns a single `CaseWithRelations` for the given caseId.
- Mutating endpoints (`POST`, `PATCH`, `DELETE`) under `/desktop/cases[...]`:
  - Implement the same behaviours as the existing `/cases` routes but via Service and Repository.

Desktop BFF should be the **primary API surface** for the desktop UI going forward.

#### Mobile BFF

Mobile BFF exposes endpoints under `/mobile` and is intended for mobile web and WeChat miniapp clients, which require lighter payloads and often different UX flows.

Key endpoints:

- `GET /mobile/cases`
  - Returns a **lightweight** case list view.
  - Each item SHOULD include:
    - `id`
    - A user-facing name (e.g., `displayName` or derived from identifier)
    - `latestReportSummary` (summary or derived text from the most recent text report, or `null`)
    - `mainThumbnail` (a representative sample thumbnail URL, or `null`)
    - `updated_at`
  - Payload MUST be derivable from the shared case business object, not from a mobile-only data model.
- `GET /mobile/cases/{caseId}`
  - Returns a **compact case detail view**:
    - Case basics: id, displayName, notes, metadata (as needed).
    - Samples: compact entries (id, modality, description, thumbnail URL, created_at).
    - Text reports: compact entries (id, title, summary, created_at).
- Additional endpoints (e.g., text report detail, analysis detail) MAY be exposed under `/mobile` as needed, but MUST reuse the same Service layer operations as desktop.

Mobile BFF is free to omit fields that are not necessary in the mobile UX, but it MUST NOT diverge in business logic or data source.

### Backwards Compatibility with `/cases`

The current `/cases` routes are heavily used by the existing desktop UI. To minimize disruption:

- During the implementation change(s), `/cases` MAY be implemented as a compatibility layer that delegates to the new Service layer (or even to `/desktop` routes) to preserve behaviour.
- New functionality SHOULD be added only under `/desktop` and `/mobile` prefixes.
- A later change can decide whether and how to deprecate `/cases`.

This design document focuses on the target architecture and does not prescribe the exact migration sequence; that is covered at a high level in `proposal.md` and more concretely in future implementation changes.

## Service Layer Design (Case Domain)

This section enumerates the main business operations the Service layer SHOULD provide for cases and related entities. Names are illustrative; concrete TypeScript signatures belong to implementation changes.

### Case Operations

1. **List Cases with Relations**
   - Purpose: Provide the full case list including samples, text reports, and tissue analysis where applicable.
   - Used by:
     - Desktop BFF for `GET /desktop/cases`.
     - Potentially mobile BFF, which will transform the full list into a lightweight list view.

2. **Get Case with Relations**
   - Purpose: Fetch a single case and all its relations (samples, text reports, tissue analysis).
   - Used by:
     - Desktop BFF for `GET /desktop/cases/{caseId}`.
     - Mobile BFF for `GET /mobile/cases/{caseId}` (after transforming into a compact view).

3. **Create or Update Case with Samples and Text Reports**
   - Purpose: Implement the current UPSERT-by-identifier semantics:
     - Create a case when identifier is new.
     - Update case metadata and/or add samples/reports when identifier already exists.
   - Responsibilities:
     - Validate request payload (identifier, display name, notes).
     - Orchestrate sample uploads and text report insertion.
     - Use a transaction to ensure consistency across tables.

4. **Delete Case**
   - Purpose: Remove a case, its associated samples, and related files.
   - Responsibilities:
     - Ensure case existence.
     - Delete database records and trigger file deletion.

5. **Update Case Basic Info**
   - Purpose: Update display name and potentially other simple attributes.
   - Responsibilities:
     - Enforce validation rules (non-empty, max length, etc.).

### Sample Operations

1. **Update Sample Metadata**
   - Purpose: Update sample description and/or modality.
   - Responsibilities:
     - Validate that the sample belongs to the given case.
     - Validate modality and description.
     - Update the `case_samples` record.

2. **Delete Sample**
   - Purpose: Remove a sample and its underlying file.
   - Responsibilities:
     - Ensure sample existence.
     - Delete database record and corresponding file(s).

3. **(Optional future operation) Add Sample to Existing Case**
   - Purpose: Support adding new samples to an existing case outside of the main case creation flow.
   - Can be introduced in later changes if UI requires it.

### Text Report Operations

1. **List Text Reports for a Case**
   - Purpose: Provide all text reports associated with a case.

2. **Create Text Report**
   - Purpose: Append a new text report to a case.
   - Responsibilities:
     - Validate payload (title, content, summary, tags, metadata).

3. **Update Text Report**
   - Purpose: Modify existing text report fields.
   - Responsibilities:
     - Validate which fields are present and enforce constraints.

4. **Delete Text Report**
   - Purpose: Remove a text report.

5. **(Optional) Get Single Text Report**
   - Purpose: Provide detailed report content; may be useful for mobile detail views.

### Tissue Analysis Operations

1. **Get Tissue Analysis for a Sample**
   - Purpose: Return the analysis object for a given sample if it exists and the sample is tissue.
   - Responsibilities:
     - Validate caseId/sampleId association.
     - Validate modality is `组织切片`.
     - Fetch analysis record from repositories and map to `TissueAnalysis` spec.

## Repository Layer Design (Data Access)

Repositories encapsulate table-level interactions and aggregate data into domain objects.

### Case Repository

Responsibilities:

- CRUD operations on `cases`.
- Query cases by filters (e.g., all cases ordered by created_at/updated_at).
- Return base `CaseRecord` objects (without relations).

### Sample Repository

Responsibilities:

- CRUD operations on `case_samples`.
- Fetch samples for one or many case IDs.
- Provide convenient methods to:
  - Count samples by modality per case (for naming and indexing).
  - Fetch storage paths for cleanup.

### Text Report Repository

Responsibilities:

- CRUD operations on `case_reports`.
- Fetch all reports for a case.
- Insert/update/delete reports with validation delegated to Service.

### Tissue Analysis Repository

Responsibilities:

- Read/write `sample_tissue_analysis` records.
- Fetch analysis by sampleId.
- Potentially support multi-version or multi-region analysis in future changes.

### Aggregation Patterns

Repositories SHOULD expose helper methods to assemble:

- A full `CaseWithRelations` by:
  - Loading a `CaseRecord` from `cases`.
  - Loading associated samples from `case_samples`.
  - Loading associated text reports from `case_reports`.
  - For tissue samples, loading analysis from `sample_tissue_analysis` and attaching to samples.
- Efficient case lists by:
  - Querying cases in batches.
  - Fetching samples and reports by caseIds.
  - Aggregating them with maps keyed by caseId.

In all of these, the repository MUST return stable domain types, independent of the underlying table layout.

## Data Source and Demo Strategy

### Single Source of Truth

For cases, samples, text reports, and tissue analysis:

- PostgreSQL MUST be the single source of truth.
- All API responses MUST be derived from:
  - Rows in the relevant tables.
  - Files present on disk (for sample images).

There MUST NOT be:

- Hard-coded “fake” case/sample/report/analysis objects returned directly from routes.
- Runtime branches that bypass the database for case data (beyond transient error handling).

### Demo Data via Seed Scripts

When demo data is required:

- It MAY be stored as JSON/TS data structures in the repo (e.g., under `demo_fake/`).
- It MUST be ingested into PostgreSQL via seed/migration scripts.
- After seeding, demo cases/samples/reports/analysis MUST be indistinguishable from “real” data in terms of API behaviour.

This ensures:

- Consistent debugging (inspect DB to see the truth).
- Smooth evolution (schema migrations apply equally to demo and real data).

## Frontend Integration Considerations

This change does not modify frontend specs, but it assumes:

- Desktop UI will, in future changes, migrate to `/desktop/...` APIs.
- Mobile UI and WeChat miniapp will migrate to `/mobile/...` APIs.

Guidelines:

- Desktop UI SHOULD consume the full `CaseWithRelations` view from `/desktop/cases` and related endpoints.
- Mobile UI SHOULD consume the lightweight list and compact detail views from `/mobile/cases` and `/mobile/cases/{caseId}`.
- Neither UI should rely on direct knowledge of database schema; they should only depend on the documented JSON contracts of these BFF routes.

## Out of Scope for This Change

- No runtime code changes in `backend/`, `frontend/`, `frontend-mobile/`, or `wechatapp/`.
- No database schema changes or migration scripts; these will be handled in future changes.
- No updates to `openspec/specs/ui/spec.md` or `openspec/specs/mobile-ui/spec.md`; this change only adds a delta under `cases`.

