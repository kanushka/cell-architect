# Mixed DSL One-Click Conversion Implementation Plan

**Design:** `docs/superpowers/specs/2026-07-22-mixed-dsl-one-click-conversion-design.md`

## Objective

Detect loose single-cell statements in a document that also contains explicit cell blocks, present one actionable diagnostic in the playground, and convert the loose statements into a uniquely named cell block when the user selects the action.

## Tasks

1. Extend `Diagnostic` with an optional `code` and mark safely convertible mixed-mode statements with `mixed-cell-mode` in `parseProject`.
2. Extract small parser classification helpers so the project parser and conversion planner share cell-header and cell-statement recognition.
3. Add a pure `planMixedDslConversion(source)` library API that preserves existing blocks and project-level syntax, moves valid loose cell statements and their leading trivia, handles `main` identifier collisions, and preserves line endings.
4. Export the planner, its result type, and the mixed-mode diagnostic code from the package entry point.
5. Add parser and planner tests for diagnostic codes, content preservation, cross-cell edges, collisions, malformed syntax, line endings, and no-op cases.
6. Update `EditorPanel` to group mixed-mode diagnostics into one recovery card, show the generated cell and moved-statement count as helper text, and apply the planner output through an outcome-first "Convert to multi-cell" action.
7. Reuse the shared neutral `pill-button` treatment used by Share and Diagrams, retain the decorative right-arrow icon, and add only the recovery-specific layout needed for full-width mobile behavior.
8. Add playground tests for grouping, action labels, conversion, unrelated diagnostics, and absent proposals.
9. Update the multi-cell DSL guide to explain the mode transition and one-click migration, then update its tests.
10. Run library and playground unit tests, typechecks, lint, and the production build. Launch the Vite playground on `127.0.0.1` for manual verification.
