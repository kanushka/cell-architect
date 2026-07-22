# Mixed DSL One-Click Conversion Design

**Date:** 2026-07-22
**Status:** Approved for implementation planning

## Overview

Cell Architect supports two document shapes:

- An implicit single-cell document, where cell statements appear at the top level.
- A multi-cell document, where local cell statements must appear inside explicit `cell <id> { ... }` blocks.

Adding the first explicit cell block to an existing single-cell document currently leaves the earlier top-level statements invalid. The parser emits the same generic diagnostic for each affected line, but it does not explain the mode transition or help the user fix the document.

The editor will detect this mixed state, explain it once, and offer a one-click conversion that moves eligible loose statements into a newly generated named cell block. Conversion is always initiated by the user; the editor will not silently rewrite source.

## Goals

- Explain clearly that explicit cell blocks activate multi-cell document rules.
- Replace repeated mixed-mode messages in the editor with one actionable recovery card.
- Convert existing loose single-cell content into a valid named cell without changing existing cell blocks.
- Preserve source ordering, comments, blank lines, project-level statements, and malformed text wherever possible.
- Keep conversion logic reusable and testable in the parser library rather than embedding it in the playground UI.

## Non-goals

- Adding a `diagram single` or `diagram multi` declaration.
- Allowing loose local statements and explicit cell blocks to coexist as valid DSL.
- Automatically modifying source when an explicit cell block is typed.
- Repairing unrelated syntax errors.
- Renaming or restructuring existing explicit cells.
- Introducing undo infrastructure beyond the editor's existing source-editing behavior.

## Document Mode Rules

Document mode continues to be inferred from syntax:

- With no explicit `cell` block, top-level cell statements form the implicit single cell.
- With at least one explicit `cell` block, the document is multi-cell and local cell statements must be inside a cell block.
- Project-level statements remain valid outside cell blocks in multi-cell mode. These include the project title, comments, blank lines, and fully qualified cross-cell dependencies.

This keeps the language concise and avoids a separate mode field that could contradict the actual source structure.

## User Experience

When a multi-cell document contains convertible top-level cell statements, the diagnostics area shows one grouped recovery card:

> **Complete multi-cell setup**
>
> You added a cell block, so the remaining loose DSL must be placed in its own cell.

The generated destination and number of statements appear as helper text:

> Creates `cell main` and moves 3 loose statements.

The helper uses the actual generated identifier and statement count, with correct singular or plural wording. If `main` is already used, it displays `cell main-2`, then `cell main-3`, and so on until it finds an unused identifier.

The primary action is labeled **Convert to multi-cell** and includes a right-arrow icon. It uses a filled, high-contrast orange treatment rather than an outlined secondary-button treatment, with clear hover and keyboard-focus states. The action spans the available card width on narrow mobile layouts.

Selecting the action immediately replaces the editor source through the existing `onSourceChange` path. The normal compile and persistence flows then run against the converted source. There is no confirmation dialog because the action is explicit, local, and visible before it is applied.

The recovery card is shown only when the conversion planner finds at least one safely convertible statement. Unrelated diagnostics remain visible before and after conversion. After a successful conversion, the mixed-mode diagnostics disappear on the next compile.

## Architecture

### Parser Diagnostics

The public diagnostic model gains an optional machine-readable `code` field. Diagnostics produced for local statements outside a cell block use:

```ts
code: "mixed-cell-mode"
```

Their user-facing message is:

> This document uses cell blocks. Components and local dependencies must be inside a named cell.

The optional field is backward-compatible for existing diagnostic consumers. The code allows the playground to group this condition without matching message text.

### Conversion Planner

The parser library exposes a pure conversion planner. It accepts source text and returns either a conversion proposal or `null`:

```ts
interface MixedDslConversion {
  source: string;
  cellId: string;
  movedLineCount: number;
}
```

The planner is responsible only for analyzing and rewriting source. It has no UI, persistence, or editor dependencies.

The planner returns `null` when:

- The source has no explicit cell block.
- The source contains no safely convertible top-level cell statements.

### Editor Integration

The editor groups diagnostics with `code: "mixed-cell-mode"` into one recovery card. It asks the planner for the proposed conversion so the helper text can show the generated cell identifier and moved-statement count. Selecting the action sends the proposal's `source` through the existing source-change callback.

Individual diagnostics with other codes or no code continue to render normally. The raw mixed-mode diagnostics remain available to library consumers; grouping is a playground presentation decision.

## Conversion Algorithm

The planner performs these steps:

1. Parse the document's top-level structure and confirm that at least one explicit cell block exists.
2. Collect all existing cell identifiers.
3. Classify top-level lines as project-level, safely convertible cell content, existing cell-block content, or uncertain/malformed content.
4. Find a unique generated identifier: `main`, followed by `main-2`, `main-3`, and higher numeric suffixes as needed.
5. Collect convertible statements together with comments and blank lines associated with that loose region, retaining their original order.
6. Wrap the collected region in `cell <generated-id> { ... }`, indenting moved non-blank lines by two spaces.
7. Insert the generated block immediately before the first existing explicit cell block.
8. Return the rewritten source, generated identifier, and count of moved non-comment, non-blank statement lines.

### Convertible Statements

The planner recognizes the same valid cell-level grammar already supported inside a cell block, including:

- Cell version metadata.
- Component declarations.
- Boundary and gateway declarations.
- Local component dependencies.
- Component-to-boundary and boundary-related dependencies.
- Gateway exposure statements.
- A cross-cell dependency whose local source is unqualified and therefore belongs to the implicit cell being converted.

Recognition must reuse parser grammar or shared classification helpers so the conversion rules do not drift from the DSL parser.

### Statements That Stay at Project Level

The planner leaves these outside the generated block:

- The project `title` statement.
- Fully qualified cross-cell dependencies whose source and target already identify their cells.
- Existing explicit cell blocks, byte-for-byte.
- Comments and blank lines associated with project-level statements.
- Unknown or malformed top-level lines.

### Source Preservation

The planner preserves the relative order of the moved content and, separately, the relative order of all content that stays at project level. Moving loose statements into the generated block necessarily changes their position relative to project-level statements. Existing cell blocks must remain byte-for-byte identical. Line endings and final-newline behavior should match the input document. Only moved lines, their indentation, and the generated block header and closing brace are intentionally changed.

Trivia association is deterministic. A run of comments and blank lines belongs to the next substantive top-level line. It moves when that next line is convertible and stays when the next line is project-level, malformed, or an explicit cell block. Comments and blank lines between convertible statements therefore move with them. Trailing trivia with no following substantive line stays at project level. This rule favors leaving ambiguous user text outside rather than moving it unexpectedly.

## Error Handling and Safety

- Conversion is opt-in and never runs during parsing alone.
- Malformed or unknown lines are not moved merely because they appear near convertible content.
- Existing syntax diagnostics are not suppressed by the recovery card.
- If the planner cannot produce a safe proposal, the editor shows the normal diagnostics without a conversion action.
- A successful conversion may still leave unrelated errors, which remain visible for the user to correct.
- The conversion result is deterministic: identical source always produces the same identifier and output.

## Documentation Changes

The DSL guide's multi-cell section will state that adding an explicit `cell` block activates multi-cell mode for the document. All local declarations and dependencies must then use cell-block notation. It will also mention that the playground offers a one-click migration when it detects loose single-cell content alongside explicit cells.

The single-cell and multi-cell examples remain separate so users can see each valid document shape clearly.

## Testing

### Parser and Planner Tests

- Mixed-mode diagnostics include `code: "mixed-cell-mode"`.
- Loose declarations and dependencies move into `cell main`.
- Associated comments and blank lines retain their ordering.
- Project title and fully qualified cross-cell dependencies stay outside.
- A cross-cell dependency with an unqualified local source moves into the generated cell.
- Existing explicit cell blocks remain byte-for-byte identical.
- Identifier collisions produce `main-2`, `main-3`, and subsequent available identifiers.
- Malformed and unknown top-level lines remain untouched and keep their diagnostics.
- Input line-ending and final-newline behavior are preserved.
- The planner returns `null` for valid single-cell documents, valid multi-cell documents, and mixed documents with nothing safely convertible.

### Playground Tests

- Multiple mixed-mode diagnostics render as one recovery card.
- The card displays the generated cell identifier and moved-statement count in its helper text.
- The primary action is labeled "Convert to multi-cell" and exposes the same accessible name without including the decorative icon.
- Other diagnostics continue to render alongside the card.
- Selecting the action updates the source through the normal callback.
- Recompilation clears mixed-mode diagnostics after a valid conversion.
- No action is displayed when the planner returns `null`.

### Documentation Tests

- Guide navigation still identifies the multi-cell section correctly.
- The guide explains the multi-cell mode transition and one-click migration.

## Acceptance Criteria

The feature is complete when a user can paste or type an explicit cell block below existing single-cell DSL, see one clear explanation of the conflict, select one action, and receive a multi-cell document where the earlier valid local content is enclosed in a uniquely named cell block without altering existing cells or valid project-level content.
