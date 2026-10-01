# Blueprint: OTel Contrib Atlas — a map-based guide to opentelemetry-collector-contrib

**Repo:** `thisisvaishnav/otel-demo` (currently empty, branch `main`, no commits)
**Status:** reviewed (23 findings applied)
**Steps:** 12 — `1 → {2a,3} → {2b,4} → {5,6,7} → 8 → 9 → 10 → 11`
**Mode:** git + gh available → branch/PR workflow. **Step 1 is the bootstrap exception** (pushes directly to `main`, which has no commits yet). All other steps: branch → PR → merge.

---

## 1. Objective

Build an **interactive web atlas** of `open-telemetry/opentelemetry-collector-contrib` that lets a new contributor see the whole project at a glance and understand its vocabulary. Five content layers:

1. **Component catalog** — all ~245 receivers/processors/exporters/extensions/connectors as clickable "islands" *(Step 4)*
2. **Terminology / glossary layer** — pipeline, consumer, confmap, mdatagen, stability, connector, distribution, feature gate, chloggen… pinned to where it applies *(Steps 3 + 8)*
3. **Data-flow pipeline map** — receivers → processors → exporters, connectors bridging signals *(Step 5)*
4. **Code architecture map** — confmap/, internal/, pkg/, testbed/, Makefile machinery, module dependencies *(Steps 2b + 6)*
5. **Contribution workflow** — issue → scaffold → test/lint → `.chloggen` → PR → CODEOWNERS reviewers *(Steps 2b + 7)*

Data comes from an **extractor script + committed JSON snapshot** (no runtime API calls). Deployed to **GitHub Pages**.

## 2. Ground truth (research findings — do not re-research)

Target repo `open-telemetry/opentelemetry-collector-contrib` (default branch `main`, ~915 MB):

- **Component counts:** 113 receivers, 47 exporters, 38 processors, 33 extensions, 14 connectors (~245 total). Top-level dirs also include `scraper/`, `confmap/`, `internal/`, `pkg/`, `cmd/`, `config/`, `docs/`, `testbed/`, `examples/`, `.chloggen/`.
- **`metadata.yaml` exists for ~367 component paths** and is machine-readable:

  ```yaml
  display_name: Prometheus Receiver
  type: prometheus
  description: |
    The Prometheus Receiver receives metric data in [Prometheus](...) format.
  status:
    class: receiver
    stability: { beta: [metrics] }        # alpha | beta | stable per signal
    distributions: [core, contrib, k8s]
    codeowners: { active: [Aneurysm9, dashpole, ...] }
  feature_gates:
    - id: ...  # stage: alpha|beta|stable, description, from_version
  ```

- **Root files of interest:** `CONTRIBUTING.md`, `issue-triaging.md`, `AGENTS.md`, `CLAUDE.md`, `distributions.yaml`, `versions.yaml`, `.mdatagen.yaml`, `Makefile`, `CHANGELOG.md`.
- **`.github/`:** `CODEOWNERS`, `ISSUE_TEMPLATE/`, `pull_request_template.md`, `workflows/`, `component_labels.txt`.
- **Local env:** git 2.52, gh 2.92 (authed as `thisisvaishnav`), Node v22.14, Python 3.14. `lychee` NOT installed.

## 3. Tech decisions (locked)

| Concern | Decision |
|---|---|
| Repo layout | npm workspaces: `packages/schema`, `extractor/`, `content/`, `atlas/` (`plans/` is plain docs, **not** a workspace) |
| Extractor | Node + TypeScript (shares types with app). Clone: `git clone --depth 1 --filter=blob:none --sparse` + `git sparse-checkout set receiver processor exporter extension connector scraper .github docs` (cone mode keeps root files) into gitignored `.extractor-cache/` |
| Schemas | Zod in `packages/schema`, **file-partitioned to avoid parallel edits**: `src/component.ts` (owner: Step 2a), `src/repo.ts` (owner: Step 2b), `src/content.ts` (owner: Step 3), `src/index.ts` pre-wired by Step 1 with placeholder exports |
| App | Vite + React + TypeScript + D3 (`d3-zoom`, `d3-selection`, `d3-force`/quadtree) |
| **Pages base path** | `vite.config.ts` sets `base: '/otel-demo/'`; all fetches use `import.meta.env.BASE_URL`; **hash routing** (`#/catalog`) so deep links survive Pages' no-SPA-fallback behavior; post-deploy URL smoke check in Step 10 |
| Rendering | Canvas for the ~245 islands (perf), SVG overlay for labels/lines, HTML detail panel |
| Lint/format | Biome (`npm run lint`, `npm run format`) + `tsc --noEmit` |
| Tests | Vitest — schema round-trips, extractor parsing fixtures, view parity tests, data-loader/filter logic (canvas tests use a **mocked 2D context** harness, never jsdom-native canvas) |
| Data paths | Generated data (`atlas/public/data/*.json`) = fetch via `BASE_URL`, written **only** by `npm run extract`. Hand-authored content (`content/*.json`) = imported directly through the bundler (Vite resolves workspace JSON imports) — never copied, never fetched |
| Deploy | GitHub Actions → GitHub Pages; scheduled + manual extractor refresh workflow opens a PR (never pushes generated data to main) |
| Dependency hygiene | `package-lock.json` committed; CI uses `npm ci`; `engines.node >=22`; `actions/setup-node` reads `node-version-file` |

## 4. Invariants — verify after every step (scoped by phase)

| Invariant | Required from | Command |
|---|---|---|
| Lint clean | Step 1 on | `npm run lint` |
| Types clean | Step 1 on | `npm run typecheck` |
| Tests pass | Step 1 on | `npm test` (Step 1: empty vitest run passes) |
| Data schema-valid | Step 2a on | `npm run validate:data` |
| Extract reproducible | Step 2a on | `npm run extract && git diff --exit-code atlas/public/data` (no churn unless upstream changed) |
| App builds | Step 4 on | `npm run build` (bundle < 1 MB gzip) |
| Data budget | Step 2a on | `jq` sanity: each data file < 500 KB, total < 2 MB |
| No runtime GitHub API | every step | code review + `grep -r "api.github.com" atlas/src` empty |
| Determinism | Step 2a on | JSON serialized with stable key/array ordering; no wall-clock or local-HEAD fields — only `meta.json` carries upstream `contrib_sha` + `schema_version` (changes only when upstream changes) |

## 5. Dependency graph

```
Step 1   bootstrap on main (scripts, workspaces, schema index stubs all pre-wired)
  ├─→ Step 2a  schema/component.ts + component extraction   ─┐  (parallel)
  └─→ Step 3   content/*.json (glossary, workflow, arch, regions.json) ─┤
        2a ─→ Step 2b  repo.ts + module graph, CODEOWNERS, repofiles, meta.json ─┐
        2a ─→ Step 4   app shell (5 stub routes pre-created)                      │ (parallel)
        4 ─→ Step 5  pipeline view                (only needs 4)
        4 + 2b + 3 ─→ Step 6  architecture view   (needs moduledeps + architecture.json)
        4 + 2b + 3 ─→ Step 7  workflow view       (needs repofiles/owners + workflow.json)
        4 + 3 ─→ Step 8  glossary overlay         (runs ∥ 5/6/7 — see Parallel sets)
        {5,6,7,8} ─→ Step 9  polish ─→ Step 10  CI+Pages ─→ Step 11  docs
```

**Parallel sets:** {2a, 3} after 1 · {2b, 4} after 2a · **{5} after 4 alone; {6, 7} after {4, 2b, 3}** · **8 after {4, 3}, runs in parallel with 5/6/7** (touches overlay + glossary files only) · 11 strictly after 10 (README must contain the live URL).

**File-ownership guarantee (replaces old §7.7):** each parallel step owns disjoint files —
`2a: packages/schema/src/component.ts, extractor/src/components/*` · `3: content/* + packages/schema/src/content.ts` · `2b: packages/schema/src/repo.ts, extractor/src/repo/*` · `4: atlas/src/{shell,routes,loader,views/catalog}/* + vite.config.ts` · `5/6/7: atlas/src/views/{pipeline,architecture,workflow}/*` (Step 4 pre-creates router entries pointing at stub modules so siblings never edit the router) · `8: atlas/src/glossary/*` · `10: .github/ + atlas/vite.config.ts (base-path only)`. Shared files (`packages/schema/src/index.ts`, root `package.json`) are pre-wired in Step 1 and never edited again — **except additive npm-script slots** (`agents:*`, `eval:*`) **and additive vitest include-globs** (`harness/test/`) required by `plans/agent-team-harness.md`; adding scripts/globs is allowed, restructuring is not.

**Model tiers:** strongest for Steps 2a and 4; default for all others; 9/10 default + review.

## 6. Steps

### Step 1 — Bootstrap monorepo on `main`

**Context:** Repo has an **empty bootstrap commit** (`a77ef6e`) and plans committed on `docs/plans-bootstrap` — this step adds the first code commit. Owns all shared wiring so parallel steps never touch root files again.
**Tasks:**
- [x] npm workspaces: `packages/schema`, `extractor`, `atlas`, `content` (package.json per workspace; `plans/` NOT a workspace)
- [x] Root scripts wired NOW: `lint`, `format`, `typecheck`, `test` (vitest, may be empty), `extract`, `validate:data`, `build`, `dev` — later steps fill implementations, scripts exist from day one
- [x] `packages/schema/src/{index.ts,component.ts,repo.ts,content.ts}` — index exports from all three; `component/repo/content` are placeholder schemas for their owner step to replace
- [x] Biome + base tsconfig + vitest config; zod + vitest as workspace deps; `engines: {"node": ">=22"}`; commit `package-lock.json` **and `.node-version` (= `22`)** for `actions/setup-node`'s `node-version-file`
- [x] `.gitignore`: `node_modules/`, `atlas/dist/`, `.extractor-cache/`, `.vite/`
- [x] Merge `docs/plans-bootstrap` (contains `plans/otel-contrib-atlas.md` + `plans/INDEX.md`) into `main` as part of this step
- [x] Minimal `README.md` (one-paragraph goal, link to plan)
- [x] Commit directly to `main`, push (`git push origin main`)

**Verify:** `npm install && npm run lint && npm run typecheck && npm test` → clean; `git log --oneline` shows bootstrap + plans merge + this step (≥3 commits); `npm run build` failure acceptable ONLY if it fails because Step 4 hasn't happened (stub error message, not crash).
**Exit:** main pushed; all scripts exist; invariants scoped to Step 1 (lint/typecheck/test) green.

### Step 2a — Component schema + extraction  ⚑ strongest

**Context:** Foundation every view depends on. `metadata.yaml` (ground truth §2) is primary source. **First task in this step:** fetch 2–3 real component READMEs via `gh api` to check whether a status table exists; the `| status |` README regex is OPTIONAL dead code unless evidence shows it matches — otherwise use `status_quality: "unknown"` fallback only.
**Tasks:**
- [ ] `packages/schema/src/component.ts` (replaces placeholder): zod `Component` (id, class, type, display_name, description, signals{traces,metrics,logs}→stability, distributions, codeowners, feature_gates, source_url, status_quality)
- [ ] `extractor/src/clone.ts`: sparse shallow clone into `.extractor-cache/` (command per §3)
- [ ] `extractor/src/components/*` (pure functions + fixtures): walk `receiver|processor|exporter|extension|connector|scraper` dirs, parse each `metadata.yaml` → Component; components without `metadata.yaml` → `status_quality: "unknown"`, **never dropped**
- [ ] Emit `atlas/public/data/components.json` + `meta.json` (deterministic: `contrib_sha`, `schema_version` — no wall clock, stable sorted keys)
- [ ] `npm run validate:data` implementation (zod, all data files) + `extractor/src/sanity.ts`: ≥200 components, every class ≥5, **each data file < 500 KB**
- [ ] Vitest fixtures: components with missing metadata, malformed yaml, all three stability classes

**Verify:** `npm run extract && npm run validate:data && npm test && git diff --exit-code atlas/public/data` (idempotent) and `jq '.components|length' atlas/public/data/components.json` → ≥ 200; `ls -la atlas/public/data/*.json` each < 500 KB.
**Exit:** committed snapshot parses, deterministic, unknown-status components badged not dropped.

### Step 3 — Glossary + narrative content (parallel with 2a)

**Context:** Hand-authored, schema-validated. Every term must state what it means + where it lives (`anchor` id) + a link evidenced in contrib source (CONTRIBUTING.md / docs / metadata) — no invented terms. Owns `content/*` and `packages/schema/src/content.ts` only.
**Tasks:**
- [x] **`content/regions.json`** — canonical registry of region + view ids; every other content file's anchors must resolve here (Step 8 CI check depends on it)
- [x] `content/glossary.json` — ≥30 terms, minimum set: pipeline, receiver, processor, exporter, extension, connector, consumer, signal, OTLP, stability (alpha/beta/stable), distribution (core/contrib/k8s), confmap, factory, mdatagen, metadata.yaml, scraper, feature gate, capability, CODEOWNERS, `.chloggen`, component status vs stability, testbed, goleak, config schema, distribution membership
- [x] `content/workflow.json` — ordered contributing stops, each with `file_anchor` into contrib (ISSUE_TEMPLATE, issue-triaging.md, CONTRIBUTING.md, mdatagen scaffold, make targets, .chloggen, pull_request_template, CODEOWNERS)
- [x] `content/architecture.json` — narratives + region defs for confmap, internal, pkg, cmd, config, testbed, docs, .chloggen
- [x] **`content/starter-issues.json`** — optional hand-curated list of good starter components/issues (schema in `content.ts`); Step 7 consumes it if present
- [x] `packages/schema/src/content.ts`: `GlossaryTerm`, `WorkflowStep`, `ArchRegion`, `Regions`, `StarterIssue` schemas

**Evidence (link check + minimum set):** `content/check-links.mjs` (gh api resolver) resolves all 51 distinct file anchors and the curated issue link against `open-telemetry/opentelemetry-collector-contrib` — 0 orphans; 39 glossary terms ≥ the required 30, covering all 25 terms of the minimum set; `content/content.test.ts` re-checks schema validity and `anchor ∈ regions.json` offline in `npm test`.

**Verify:** `npm test` — Step 3's own vitest suite parses every `content/*.json` against its `content.ts` schemas and asserts every anchor id ∈ `regions.json` (the cross-file `npm run validate:data` integration runs from Step 2a onward, per §4); link check with **`gh api` resolver as primary** (`gh api repos/.../contents/<path> --jq .sha` per anchor; `lychee` optional only): all file anchors resolve; term count ≥ 30.
**Exit:** content committed, all anchors resolve against `regions.json`.

### Step 2b — Repo metadata extraction (parallel with 4, after 2a)

**Context:** Feeds architecture (6) and workflow (7) views. Uses `packages/schema/src/repo.ts` + `extractor/src/repo/*`.
**Tasks:**
- [ ] `packages/schema/src/repo.ts`: `ModuleDep`, `RepoFile` schemas
- [ ] Per-directory `go.mod` requires filtered to `github.com/open-telemetry/opentelemetry-collector*` → `moduledeps.json`
- [ ] `.github/CODEOWNERS` → owner/path pairs; `distributions.yaml` → membership; `docs/`, `CONTRIBUTING.md`, `issue-triaging.md`, `.chloggen/` headings → `repofiles.json` — the file/dir keys must also cover every `file_anchor` in `content/workflow.json`, because Step 7's parity test asserts membership (Step 3 supplies that list)
- [ ] Sanity: ≥10 module deps, CODEOWNERS non-empty, all emit paths < 500 KB
- [ ] Vitest fixtures for go.mod parsing + CODEOWNERS pattern matching

**Verify:** `npm run extract && npm run validate:data && npm test`; `jq 'length' atlas/public/data/moduledeps.json` ≥ 10.
**Exit:** snapshot extended; determinism invariant holds.

### Step 4 — Atlas app shell  ⚑ strongest

**Context:** After 2a (needs `components.json`). Creates ALL shared routing/nav so Steps 5–7 never edit router files. Imports hand-authored `content/*.json` via bundler imports; fetches generated data via `import.meta.env.BASE_URL` (Pages base `/otel-demo/`).
**Tasks:**
- [ ] Vite + React + TS; `vite.config.ts` with `base: '/otel-demo/'`
- [ ] **Hash router** with five routes pre-created: `#/catalog`, `#/pipeline`, `#/architecture`, `#/workflow`, `#/glossary` — pipeline/architecture/workflow/glossary render stub modules ("coming in Step N") that sibling steps replace in their own files
- [ ] Data loader: `fetch(\`${import.meta.env.BASE_URL}data/components.json\`)`; typed against `packages/schema`
- [ ] Catalog view: canvas world, pan/zoom (`d3-zoom`), landmass per class, islands sized/colored by stability (legend), click → detail panel (display_name, stability matrix, codeowners, distributions, feature gates, GitHub source link)
- [ ] Search/filter (name, signal, class, codeowner) with keyboard nav + result highlight
- [ ] Vitest: data-loader + filter logic; rendering tests only via **mocked 2D-context harness** (jsdom has no canvas)

**Verify:** `npm run dev` manual pass on catalog; `npm run build && npm run lint && npm run typecheck && npm test`; bundle < 1 MB gzip; `npm run build && grep -r "api.github.com" atlas/src` empty.
**Exit:** catalog live on real data; four stub routes reachable via hash URLs (survive a `BASE_URL`-prefixed static serve: `npx serve atlas/dist` then open `/#/pipeline`).

### Step 5 — Data-flow pipeline view (parallel; needs 4)

**Context:** Owns `atlas/src/views/pipeline/*` only. Topology derived from `Component.class` + `signals` — never a hand-drawn graph.
**Tasks:**
- [ ] Three horizontal signal lines (traces/metrics/logs); stations = components whose `signals` include that line
- [ ] Connectors with ≥2 signals render as interline transfer stations (line A ↔ line B)
- [ ] Hover → highlight same-class neighbors; click → shared detail panel component (imported from Step 4's `views/catalog/detailPanel`)
- [ ] Default filter stable+beta only; toggle to show all (alpha badged)

**Verify:** invariants + **parity Vitest test** (replaces unverifiable jq prose):
```ts
// stations on traces line === number of components with traces signal
expect(tracesStationCount()).toBe(components.filter(c => c.signals.traces).length);
// same for metrics, logs; transfers === connectors with ≥2 signals
```
Run: `npm test`.
**Exit:** view routed (router already wired by Step 4), parity test green.

### Step 6 — Code architecture view (parallel; needs 4 + 2b + 3)

**Context:** Owns `atlas/src/views/architecture/*`. Inputs: `moduledeps.json`, `repofiles.json` (2b), `content/architecture.json` (3).
**Tasks:**
- [ ] Region cards for confmap, internal, pkg, cmd, config, testbed, docs, .chloggen — narrative from content + file anchors opening GitHub
- [ ] Force-directed module graph (d3-force) from `moduledeps.json`; click node → component dirs in that module
- [ ] Makefile machinery strip: `make gotest`, `make gotest-module`, `make lint`, mdatagen, schemagen — each tagged with which workflow stop uses it

**Verify:** invariants + **Vitest view test**: every region id in `content/architecture.json` renders; every module node has ≥1 edge or is declared isolated; `components.json` dirs referenced exist.
**Exit:** parity test green.

### Step 7 — Contribution workflow view (parallel; needs 4 + 2b + 3)

**Context:** Owns `atlas/src/views/workflow/*`. Inputs: `content/workflow.json` (3), `repofiles.json`/CODEOWNERS (2b).
**Tasks:**
- [ ] Numbered journey path; each stop expands to: what to do, file anchor (GitHub link), command to run
- [ ] Stops must include the full path: find issue → CONTRIBUTING → mdatagen scaffold + metadata.yaml → tests → `make lint gotest` → `.chloggen` → PR template → CODEOWNERS reviewers
- [ ] "Starter components" helper = **low-owner filter from `components.json` only** (≤1 active owner, stable status) — no issue-tracker data (runtime API banned) — merged with curated picks from `content/starter-issues.json` **if that file exists** (created by Step 3; `content/*` remains Step 3-owned)

**Verify:** invariants + **Vitest view test**: every stop's `file_anchor` exists in `repofiles.json`; owners rendered for a sampled component deep-equal `components.json` codeowners.
**Exit:** parity test green.

### Step 8 — Glossary overlay (parallel with 5/6/7; needs 4 + 3)

**Context:** Owns `atlas/src/glossary/*` only — no shared files with 5/6/7.
**Tasks:**
- [ ] Global "Glossary" toggle: term pins on anchored region/view; pin → popover (definition + source link)
- [ ] Glossary browser: searchable A–Z, deep link to pin
- [ ] CI check in `validate:data`: every glossary/workflow/arch anchor id exists in `content/regions.json` → **fail on orphans**

**Verify:** invariants + deliberately orphan an anchor in a scratch test → `npm run validate:data` must fail (then revert); real data passes with 0 orphans.
**Exit:** all five content layers present in the app.

### Step 9 — Polish, a11y, performance

**Context:** Integrates outputs of 5, 6, 7, 8. Owns cross-cutting `atlas/src` styling/a11y files (not sibling view internals — request changes there instead).
**Tasks:**
- [ ] Keyboard nav across canvas (arrow/tab island traversal), focus rings, screen-reader labels; contrast check on stability colors
- [ ] Mobile: pinch-zoom, stacked detail panel
- [ ] Perf: canvas redraw throttling, detail-list virtualization; bundle budget re-check; Lighthouse pass on static build (`npx lighthouse` against `serve atlas/dist`)
- [ ] Empty/error states: missing metadata → "status unknown" badge; failed fetch → retry panel

**Verify:** invariants + `npm run build` bundle budget + a11y checklist pasted into PR description.
**Exit:** shippable UI.

### Step 10 — CI + GitHub Pages deploy + data refresh

**Context:** After 9. Repo automation; touches only `.github/` + `atlas/vite.config.ts` if a base-path fix surfaces.
**Tasks:**
- [ ] `.github/workflows/ci.yml` (PR): `npm ci`, lint, typecheck, test, validate:data, build (post-build grep: no `api.github.com` in `atlas/src`). **This step CREATES `ci.yml`.** The harness plan's S9 only EXTENDS it and is ordered AFTER this step; if S9 landed first (fallback minimal CI), this step must merge/reconcile, not overwrite (dedup note mirrored in `agent-team-harness.md` §0/S9)
- [ ] `.github/workflows/extract-refresh.yml`: `workflow_dispatch` + weekly cron → `npm ci && npm run extract` → open PR if `git diff` non-empty (never push generated data to main); includes optional lychee link-rot pass over `content/*.json`
- [ ] `.github/workflows/deploy.yml` (main): build → Pages; enable Pages via `gh api` if absent
- [ ] **Post-deploy smoke check job/curl:** `curl -fsS "$SITE/otel-demo/"` and `curl -fsS "$SITE/otel-demo/data/components.json"` (base-path + data path verified from real Pages URL)
- [ ] Footer "data as of" stamp from `meta.json` (`contrib_sha`, `schema_version`)

**Verify:** dispatch `extract-refresh` → PR opens or "no changes"; open PR → CI green; merge → Pages URL live; smoke-check job green against the real URL.
**Exit:** live URL with green smoke check.

### Step 11 — Repo docs (after 10 — README needs the live URL)

**Context:** Last step; inputs: working app (9) + live URL (10).
**Tasks:**
- [ ] `README.md`: what this is, screenshot/GIF, **live link (real URL from Step 10)**, workspaces diagram of THIS repo, run instructions (`npm i && npm run extract && npm run dev`)
- [ ] `CONTRIBUTING.md`: hand-authored (`content/`) vs generated (`atlas/public/data/`) ownership, "never edit generated data by hand", PR checklist
- [ ] `content/README.md`: how to add a glossary term / workflow stop (schema + validation)

**Verify:** follow README verbatim from a clean `git clone` + `npm ci` in a fresh shell — every command succeeds.
**Exit:** docs merged; blueprint complete.

## 7. Anti-pattern watchlist (reviewer: check each)

1. **Runtime GitHub API calls** in the app — data must be committed; CI grep enforces
2. **Hand-editing generated JSON** — generation only; PR review rejects edits to `atlas/public/data/`
3. **Monolithic extractor** — pure functions + fixtures, testable without cloning
4. **Non-sparse clone** — `--depth 1 --filter=blob:none --sparse` with sparse-checkout is mandatory, not a fallback
5. **SVG for 245 islands without LOD** — canvas for catalog
6. **Unevidenced content** — every glossary term / workflow stop cites a contrib file anchor
7. **Parallel-step file collisions** — §5 file-ownership table; any PR touching a non-owned file is rejected
8. **Skipping phase-scoped invariants** — §4 table defines minimum per step; a failed invariant = rollback
9. **Giant PRs** — >600 changed lines of ANY code (app, extractor, schema) → split per mutation protocol
10. **Silently dropping unknown-status components** — must be visibly badged
11. **Nondeterministic data output** — unsorted keys or wall-clock/HEAD fields → weekly refresh PR churns with zero upstream changes (exception: `meta.json` carries only upstream `contrib_sha`/`schema_version`)
12. **Dependency hygiene gaps** — lockfile committed, `npm ci` in CI, node ≥22 pinned in `engines` + `setup-node`
13. **Broken Pages base path** — absolute `/data/*.json` fetches or path routing without fallback = 404s in prod (CRITICAL class)
14. **Data bloat** — >500 KB per data file or >2 MB total fails sanity (descriptions trimmed/first-paragraph only)

## 8. Risks & rollback

| Risk | Mitigation |
|---|---|
| Components lacking `metadata.yaml` | unknown-status fallback + badge (invariant: never drop) |
| Clone slow in CI | sparse + blob filter + Actions cache of `.extractor-cache/` |
| D3 + canvas complexity | strongest-tier Step 4; mocked-2D-context tests first |
| Anchor id drift | Step 8 orphan check inside `validate:data` (CI-enforced) |
| Pages base path wrong | Step 4 hash-routing + `BASE_URL` fetches; Step 10 real-URL smoke curl |
| README status-table fallback dead | verified against real READMEs in Step 2a first task; dropped if unevidenced |

Each step rolls back by reverting its merge commit; Steps 5/6/7/8 are disjoint view files — one can be abandoned without affecting siblings (mutation protocol).

## 9. Mutation protocol (during execution)

- **Split:** >600 lines of any code → split by §5 file ownership, re-run dependency check, log here
- **Skip:** only if exit criteria covered elsewhere → record `SKIPPED: <step> — covered by <step>`
- **Reorder:** only if dependency edge satisfied → update §5 in the same PR
- **Abandon:** `ABANDONED: <step> — <reason>`, cascade-check dependents first

## 10. Execution log

| Date | Change |
|---|---|
| 2026-10-01 | Blueprint drafted (research: gh API, 367 metadata.yaml confirmed) |
| 2026-10-01 | Review r1: 23 findings (1 critical, 11 major, 11 minor) — all applied: Pages base/hash routing, DAG edges 3→6/7, schema file partitioning, stub routes (schema stubs in Step 1, router stubs in Step 4), phase-scoped invariants, content import path, regions.json owner, meta.json emitter, Step 2 split into 2a/2b, parity vitests for 5/6/7, determinism + dependency-hygiene watchlist, sparse clone mandatory, gh-api link check, low-owner-only helper, data size budget, docs moved after deploy |
| 2026-10-01 | Review r2: 7 findings (2 major, 5 minor) — all applied: Step 3 verify decoupled from sibling's validate:data, starter-issues moved to Step 3 ownership, §5 garble cleaned, {5} gated on 4 only, Step 10 file-ownership carve-out, .node-version file, npm ci in refresh workflow |
| 2026-10-01 | Step 1 executed: monorepo bootstrap pushed to `main` — plans branch merged, npm workspaces (schema/extractor/content/atlas), root scripts wired, schema placeholder exports, Biome + tsconfig + vitest, `.node-version`/lockfile committed |
| 2026-10-02 | Step 3 executed (PR, parallel with 2a): content layer shipped — `regions.json` registry (5 views, 26 regions incl. the 8 architecture regions), 39 glossary terms (all 25 of the minimum set), 9 ordered workflow stops, 8 architecture narratives, 7 curated starter picks; `content.ts` schemas + `contribUrl()` helper; offline vitest suite (32 tests) asserts schema validity, `anchor ∈ regions.json` and `file_anchor ↔ region.path` consistency, `content/check-links.mjs` resolves 51 file anchors + the curated issue via `gh api`; `content` workspace gains its own `typecheck`/`check-links` scripts and declares `@otel-demo/schema` (lockfile entry only); Step 2b's `repofiles.json` task annotated to cover every workflow `file_anchor` so Step 7's parity test can hold |
