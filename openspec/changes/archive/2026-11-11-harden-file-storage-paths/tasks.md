## 1. Storage boundary and write flow

- [x] 1.1 Add a single path resolution and boundary-checking helper for storage keys, including absolute paths, traversal components, normalization, and symlink checks.
- [x] 1.2 Change new-file naming to use a backend-generated unpredictable unique name and keep the original name only in existing display/database fields.
- [x] 1.3 Create a same-filesystem, application-controlled staging directory with restrictive permissions; write with exclusive creation and publish with a verified no-replace primitive (prefer `fs.link` plus unlink of the staging name), never ordinary rename.
- [x] 1.4 Apply the same boundary and symlink validation to deletion of both new and legacy `/uploads/...` paths; preserve existing missing-file behavior.
- [x] 1.5 Keep `storage_path`, `storage_thumbnail`, API response shapes, frontend URL construction, and `/uploads` static serving compatible; ensure `.staging` is not statically exposed.
- [x] 1.6 Define fail-closed behavior and diagnostics when the target platform/filesystem cannot verify no-replace publication; do not fall back to ordinary rename.

## 2. Automated verification

- [x] 2.1 (逻辑路径层) Test accepted normalized relative keys and rejection of `..`, encoded traversal, absolute paths, empty keys, and root escapes without touching the filesystem.
- [x] 2.2 (真实文件系统层) Test rejection of symlinked directories and symlinked target files, including a link that resolves outside the storage root.
- [x] 2.3 Test that duplicate logical names produce distinct unpredictable paths and that an existing target is never overwritten.
- [x] 2.4 Run a real concurrent race test with many writers targeting the same logical input and assert no successful operation overwrites another result, all successful contents are complete, and no staging names remain.
- [x] 2.5 Test symlink creation/replacement races around validation and commit; assert outside-root files are unchanged. Document the residual risk for a local actor able to mutate the storage root.
- [x] 2.6 Test failures during temporary write, no-replace publication, and cleanup; assert only request-owned staging paths are removed, formal files are not removed by a database rollback handler, and cleanup failures produce diagnostic logs.
- [x] 2.7 Test `/uploads/.staging/...` is explicitly rejected after path normalization (including encoded/duplicate-separator variants), while existing legacy and new formal paths remain accessible.
- [x] 2.8 Verify the first-release supported platform, WSL2 Linux + ext4; record that Windows/NTFS is not supported in this Change and will be handled by a future independent cross-platform support Change.
- [x] 2.9 Run `openspec validate harden-file-storage-paths --strict`, logical path tests, real filesystem storage/static tests, and the relevant backend build; record actual results and unsupported-platform fail-closed outcomes.
