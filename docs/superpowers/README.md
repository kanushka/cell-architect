# Design specs and implementation plans

This directory is the project's design history. Each feature was written up before it was
built, and the write-up is kept afterwards rather than deleted.

- **`specs/`** — design documents. What problem a feature solves, the options considered,
  and the reasoning behind the one chosen.
- **`plans/`** — the implementation plans derived from those specs, broken into steps.

## Why these are published

They answer the question a diff cannot: *why is it like this?* If you are wondering why the
DSL is shaped the way it is, why manual layout is deliberately temporary, or why the
renderer went to a two-level layout, the spec that decided it is here.

They are also useful before proposing a change — a feature that was considered and rejected
usually has its reasoning written down, and that context is worth having before reopening the
question.

## How to read them

These are **historical records, not current documentation**. A document describes the design
as it stood when the work was planned, and later work has moved on in places without
amending it. Where a document and the code disagree, the code is correct.

For how the DSL behaves today, see [`docs/dsl-guide.md`](../dsl-guide.md). For what the
project is trying to be, see [`docs/requirements.md`](../requirements.md).

Filenames are prefixed with the date the work was planned. Nothing here is generated at
build time or consumed by the app.
