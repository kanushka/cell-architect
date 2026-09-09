# `cell-diagram` skill evals

Measures whether an agent, handed a prose architecture brief, produces a `.cell` document that
both **compiles** and **places things where a cell architect would**.

## Layout

```
cases/<id>/prompt.md    prose architecture brief given to the agent
cases/<id>/expect.json  name-insensitive expectations for the compiled model
runs/<arm>/<id>.cell    what an agent produced for that brief
score.test.ts           compiles every run and scores it against expect.json
```

Run it:

```bash
npx vitest run evals/cell-diagram/score.test.ts
```

## Scoring

Two tiers per case:

1. **Hard** — `compileProject(source)` returns `diagnostics: []`. Deterministic, no judgment.
2. **Rubric** — checks over the compiled model. Checks match by regex against ids *and* labels, not
   exact ids, because the agent picks the names. What is scored is **placement**, not naming.

Check kinds are defined in `score.test.ts`: `cellCount`, `componentMatching`, `externalOn`,
`inboundOn`, `noExternalMatching`, `externalCount`, `edgeKind`, `crossEdgeCount`, `crossEdgeMode`,
`sharedExternal`, `projectTitle`, `cellLabel`, `cellVersion`.

## Cases

| Case | What it discriminates |
| --- | --- |
| `c1-order-cell` | Basic single cell; the cell's own datastore stays **inside** |
| `c2-boundaries` | north vs west (public vs intranet ingress), east vs south (platform vs third-party egress) |
| `c3-exposure` | Gateway exposure when the counterpart has no identity — must **not** invent a placeholder external |
| `c4-multicell` | Cell blocks, project title, cross-cell link, shared external by matching id |
| `c5-decoupled` | Cyclic cell dependency needs a decoupled (`south-<entry>`) cross-cell link |

## Arms

| Arm | What the agent had | Result |
| --- | --- | --- |
| `golden` | Hand-written by the skill author | 5/5 — proves the rubric is satisfiable |
| `with-skill-opus` | Only `skills/cell-diagram/`, isolated from this repo | 5/5 |
| `with-skill-haiku` | Same, run on Haiku 4.5 | 5/5 |
| `_control-not-scored` | **Nothing** — no grammar, no skill | Does not produce `.cell` syntax at all |
| `_docs-only-not-scored` | `docs/dsl-guide.md` from this repo, no skill | Compiles, but fails the client-app rule |

`_`-prefixed arms are recorded as evidence and excluded from scoring, so the suite stays green while
the RED-phase runs remain inspectable.

**The skill is not carrying a large model.** `with-skill-haiku` is the same isolated setup run on
Haiku 4.5 and scores identically — client apps inside the cell with `north ->` / `west ->` ingress,
`east` for platform services and `south` for SaaS, and `south-north` to decouple the cyclic
back-edge in `c5`. A reference that only works when the model could have guessed anyway is not
worth shipping; this one closes the gap for a small model too.

### Variance, and what it fixed

A single run per case flatters. Four reps per case on Haiku scored **17/20**. All three failures were
informative:

| Failure | Diagnosis |
| --- | --- |
| Declared the shared external once at the **top level** (`south s3` outside any block) → compile error | Skill gap: nothing said project-level external declarations don't exist |
| Invented `east objectStore as "Object Store"` for an explicitly undecided system | Stated rule didn't bind |
| Portal inside the cell but Ops Console on `west`, in one document | Stated rule didn't bind |

The first was fixed by documenting it. The other two were both cases of a *prohibition* ("never
invent a placeholder external") that the model read and then ignored under the pull of making the
diagram look complete. Replacing the prohibition with a mechanical **proper-noun test** — does the
brief name this thing, or only its category? — measurably changed the outcome:

| `c3` wording | Pass rate |
| --- | --- |
| "Never invent a placeholder external" | 4/7 |
| Proper-noun vs category-noun test | 4/4 |

Small samples, but the separation is clean and it matches the general finding that a positive
recipe binds where a prohibition negotiates.

The c2 and c4 fixes are measured at 3/3 each — weak evidence that they are fixed rather than that
the reps got lucky. Iteration stopped there rather than tuning wording against a handful of samples.

### What is and isn't committed

`golden/` is source: it pins the rubric, so if a check becomes unsatisfiable it goes red. The
`with-skill-*` arms are the current claim, one snapshot per model.

Repeated runs are a *measurement*, not a fixture — the rates above are the durable result, so the
raw files were pruned to the two that back a specific claim:
`_haiku-variance-not-scored/c3-propernoun-retest/` (the wording comparison) and
`shared-external-at-top-level-MISTAKE.cell` (the compile error that prompted documenting
project-level externals). Repeats are also deliberately not scored arms: a gate that fails 15% of
the time is a flaky test, not a signal.

To run an arm on another model, stage a copy of `skills/cell-diagram/` plus a case brief in an
isolated directory, have the agent write `answer.cell`, and drop the results in
`runs/<arm-name>/<case-id>.cell`. Isolation matters — an agent that can see this repo will find
`docs/dsl-guide.md` and the arm stops measuring the skill.

### What the arms established

The **control** is the honest baseline for how this skill is actually consumed: installed via
`npx skills add` into someone else's project, where `docs/dsl-guide.md` does not exist. That agent
invented a Structurizr-shaped DSL (`component X { label "..." }`, `ingress`/`egress` blocks) and
reported *"confidence it is valid `.cell` syntax: very low"*. Its **modelling was correct** — owned
Postgres inside, Stripe as an egress third party, HTTPS ingress from the public internet.

The **docs-only** arm scored 83/84 on the first pass, and the single miss was a flawed expectation
on our side, not a bad answer (see below). A capable agent handed the grammar already makes most of
the subtle calls correctly: owned database inside the cell, `east` for another team's platform API vs
`south` for SaaS, `south-north` to break the cycle in `c5`.

So **the load-bearing part of this skill is the portable grammar**. Most of the modelling advice is
insurance against drift rather than a fix for a demonstrated failure.

**Except one rule.** Handed only `docs/dsl-guide.md`, agents consistently put client apps *on* the
boundary — `north CustomerPortal`, `west OpsConsole`, `north customerApp` — because the guide's own
sample does. The project's intent is the opposite: a cell is the project boundary, so the UIs that
belong to the project belong **inside** it, and a UI moves to a boundary only when the brief calls it
third-party or another org's. That is the one place where the skill demonstrably changes the output,
and it is why `_docs-only-not-scored` fails `c2` and `c4` under the current rubric while
`with-skill` passes.

### Expectations fixed during the run

Twice, a run "failed" because the rubric was wrong, not the answer. Both are recorded here because
they are the substantive design decisions the eval forced into the open.

**`c1`, ingress with an anonymous consumer.** The check originally required a declared external on
`north`. An agent instead wrote `north -> WebApp`, a bare gateway exposure, reasoning that "the
public internet" is an anonymous population rather than a named system. That is defensible —
arguably better than inventing a `CustomerApp` node that duplicates the internal web app.

**`c2`, first-party UIs.** The checks originally required named externals on `north` and `west`. Once
the skill stated that ownership decides inside-vs-boundary, agents put the customer portal and Ops
Console *inside* the cell with `north -> portal` / `west -> ops`. The DSL takes no position here —
the project's own sample in `docs/dsl-guide.md` has an internal `WebApp` component *and* external
portals on boundaries — so forcing one convention would have been the eval inventing a rule.

Both became `inboundOn`, which asserts only that ingress crosses the correct side and accepts either
form. `c2` still discriminates public-vs-intranet ingress and `east`-vs-`south` egress, which is
what the case is actually for. The skill now names a default for unstated ownership so that output
is at least deliberate and consistent, rather than a coin flip per document.

### Gaps the with-skill arm found

Agents were asked to critique the skill, not just use it. Their reports drove a second revision:
`type` is free-form text with no enum (so a recommended role vocabulary was added), the original
worked example was the `c2` brief verbatim (replaced — an example that *is* a test case measures
nothing), gateway exposures do take labels, a cyclic two-cell example was missing, and the
verification section was a dead end offline (now a placement checklist, since every placement
mistake compiles cleanly).

## Adding a case

1. Write `cases/<id>/prompt.md` as prose. Do not use DSL vocabulary in the brief — the point is to
   test the translation from how people actually describe systems.
2. Write `cases/<id>/expect.json` with regex-based checks that survive different naming choices.
3. Hand-write `runs/golden/<id>.cell` and confirm it passes. If your own answer cannot pass, the
   rubric is wrong.
