# Blueprint: Agent-Team Harness for OpenCode + Antigravity CLI

**Repo:** `thisisvaishnav/otel-demo`, branch `docs/plans-bootstrap`
**Status:** reviewed (r1: 28 findings applied)
**Steps:** 10 (+ 2 human gates H1, H2)
**Mode:** branch → PR per step. Human gates block merge until the user approves.

---

## 0. Precondition & repo reality (verified 2026-10-01)

- `main` = empty bootstrap commit `a77ef6e` + plans once merged; `docs/plans-bootstrap` = `plans/otel-contrib-atlas.md` + `plans/INDEX.md`.
- **Before executing S1:** commit **all three `plans/*` files** (this plan is untracked; `INDEX.md` + `otel-contrib-atlas.md` carry uncommitted review fixes) to `docs/plans-bootstrap`, then merge that branch → `main` (the merge itself is owned by atlas Step 1).
- **Atlas dependency:** S1 needs a repo with plans present. S7's full eval subset additionally needs atlas progress — handled by per-task `requires_atlas_step` tags (S7), NOT by blocking S7.
- **CI dependency:** atlas Step 10 creates `.github/workflows/ci.yml`; harness S9 **extends it and is ordered after atlas Step 10**. Fallback if harness S9 lands first: create a minimal `ci.yml` marked `# harness-fallback — atlas Step 10 must merge-reconcile, not overwrite` (mirror note exists in atlas Step 10).

## 1. Objective

Implement the specialized-agent team pattern (source: user-supplied design doc, inlined 2026-10-01 — its content is **restated in full in `agents/README.md`** so no step needs the original): **plan first → generate a team of agents → build with that team**. The team (8 agents) executes `plans/otel-contrib-atlas.md` and is reusable in future projects. Targets **both CLIs from one canonical source**:

- **Canonical (hand-edited):** `agents/*.md` (7-question template) and `skills/<name>/SKILL.md`
- **Sync script emits:**
  - Agents → `.opencode/agents/<name>.md` AND `.agents/agents/<name>/agent.md`
  - Skills → **both discovery shapes in the shared dir**: `.agents/skills/<name>/SKILL.md` (OpenCode dir-shape) AND `.agents/skills/<name>.md` (Antigravity flat-shape). The "one dir, two shapes" claim is an emission result, not a native-single-file coincidence — paths re-verified against docs in S2.
- **Harness:** `harness/shared-context.md` (inlined into every generated prompt), `harness/eval/` (18 machine-checked tasks), optimizer-proposal workflow with human approval.

Roster: `orchestrator, architect, backend-dev, frontend-dev, test-writer, reviewer, debugger, optimizer`.

## 2. Ground truth (research findings — do not re-research)

**OpenCode** (opencode.ai/docs/{agents,skills,commands}, fetched 2026-10-01):
- Agents: `.opencode/agents/<name>.md` (project) / `~/.config/opencode/agents/` (global); filename = agent name. Frontmatter: `description` (required), `mode` (primary|subagent|all), `model`, `temperature`, `steps`, `hidden`, `color`, `permission`.
- `permission` values are exactly **`allow` | `ask` | `deny`**; keys: `read, edit, glob, grep, list, bash, task, external_directory, todowrite, webfetch, websearch, lsp, skill, question`. `read`/`edit`/`bash` accept glob-pattern objects (scoped edits possible).
- **`permission.task`** glob-gates subagent spawning (`{"*": "deny", "backend-dev": "allow", ...}`; last match wins). No Antigravity equivalent.
- Skills: dir-shape **only**: `.opencode/skills/<name>/SKILL.md` and `.agents/skills/<name>/SKILL.md` (both project-discoverable). Frontmatter: `name` (req, `^[a-z0-9]+(-[a-z0-9]+)*$`, = dir name), `description` (req, ≤1024 chars).
- Commands: `.opencode/commands/<name>.md`; frontmatter `description`, `agent`, `subtask`, `model`; body supports `$ARGUMENTS`, `$1..`, `` !`shell` ``, `@file`.

**Antigravity CLI** (antigravity.google/docs/{cli/subagents,cli/commands,subagents}, blog 2026-08-12, fetched 2026-10-01):
- Agents: `.agents/agents/<name>/agent.md` (dir-per-agent) / `~/.gemini/config/agents/<name>/agent.md`. Frontmatter: `name` (req), `description` (req, planner delegates on it), `tools` (string[]), `mainAgent`, `subagent`, `model` (`inherit|flash|pro`), `commandExecutionPolicy` (`off|auto|eager|sandbox`), `permissionMode`, `skills` (path[] e.g. `skills/security-checklist`), `mcpServers`, `hidden`, `inheritMcp`.
- ⚠️ **Known issue:** misspelled `tools` entry can **hang** the subagent → whitelist hard-fail required.
- Skills: **flat-shape** workspace files: create dir `.agents/skills/`, put `<name>.md` inside → becomes slash command. Global: `~/.gemini/antigravity-cli/skills/`.
- Workflows: `.agents/workflows/<name>.md` (frontmatter `description`, body = orchestration steps) → slash commands. Team identity: `.agents/agents.md` (codelab pattern).
- Invocation: `invoke_subagent`; `subagent: true` required. Known asymmetries vs OpenCode: no glob file-permissions, no task gating → prompt-level enforcement (documented, not hidden).

**Pattern source:** the 7-question agent template (Role · Scope · Inputs/Outputs · Tools · Quality bar · Skills to load · Escalation rule) came from the user-supplied design doc; S1 restates it completely in `agents/README.md`.

## 3. Tech decisions (locked)

| Concern | Decision |
|---|---|
| Canonical agent frontmatter (DEFINED — no ambiguity) | `name` (kebab, = filename) · `description` (one-liner for delegation) · `tier: strong\|default\|fast` · `mode: primary\|subagent` · `tools: [canonical set]` · `owns: [globs]` (optional) · `forbids: [prose]` (optional, prompt-scope only) · `skills: [names]` · optional pass-through `temperature`, `steps`. **Permissions are DERIVED by sync** (tools + owns + tool-map); there is no separate `permission-intents` field |
| Tier mapping | Antigravity: `strong→pro, fast→flash, default→inherit`. OpenCode: `model` unset (user's global model applies; README documents how to pin). Never hardcode provider model ids in canonical files |
| Sync engine | `harness/sync.mjs` (Node): canonical → both native agent files + **both skill shapes**; inlines `harness/shared-context.md` into every system prompt; deterministic (sorted, no timestamps); `# GENERATED by harness/sync.mjs — edit agents/<name>.md or skills/<name>/SKILL.md` headers |
| Tool mapping | `harness/tool-map.json`: canonical tool → OpenCode permission key + Antigravity tool name; Antigravity names ⊆ `harness/antigravity-tools.json` whitelist (verified against live `agy` in S2 if installed, else docs + marked untested in `format-notes.md`) |
| Generated zones (all sync-owned) | `.opencode/agents/`, `.agents/agents/`, `.agents/skills/` — **fully generated, never hand-edited**. Hand-authored: `agents/`, root `skills/`, `harness/`, `.opencode/commands/`, `.agents/workflows/` |
| Task gating | OpenCode: orchestrator `permission.task` allow-list = the 7 non-orchestrator agents. Antigravity: prompt rule + `subagent: true` (gap documented) |
| Optimizer safety | Writes ONLY to `harness/proposals/<date>-<slug>.md` (diff + before/after eval evidence). Forbidden by scope from: `agents/**`, generated zones, `harness/eval/**`, `harness/eval/results/results.jsonl` (cannot rewrite the checks it is graded on). Human applies approved proposals (H2 standing rule) |
| `agents:check` (DEFINED) | = `validate.mjs` (7-section template, frontmatter schema, budgets, whitelists, skill refs, canonical skills shape) + `sync` + **drift check** (`git diff --exit-code` on generated zones **+ `git status --porcelain` on generated zones** to catch untracked/missing) + **parity check** (`.opencode/commands/*.md` name-set == `.agents/workflows/*.md` name-set, each has `description`, cross-refs resolve) |
| `agents:export` (DEFINED) | Implemented in S2: copies synced outputs to `~/.config/opencode/agents/` or `~/.gemini/config/agents/<name>/agent.md`; `--dry-run` prints targets; prompts confirm before overwrite. Docs in S10 |
| Eval | `harness/eval/tasks/T*.yaml` (18): `id, title, agent, requires_atlas_step, prompt, setup?, checks[]`; every check = shell command exit 0. Runner `harness/eval/run.mjs`: **isolates `setup` in a temp git worktree**, teardown asserts `git status --porcelain` empty (planted bugs can't leak); appends committed `harness/eval/results/results.jsonl`. Agent execution: programmatic if `opencode run --agent` / `agy` non-interactive works (verified S7; fallback = documented manual loop — never fake automation) |
| Workflows | Hand-written pairs, identical names: `.opencode/commands/<n>.md` ↔ `.agents/workflows/<n>.md`; **parity machine-checked** by `agents:check` (not just a doc table) |
| Shared context | `harness/shared-context.md` ≤ **6 KB** (validator): repo map, atlas invariants, ownership summary, escalation protocol |

## 4. Invariants — verify after every step (scoped)

| Invariant | From | Command |
|---|---|---|
| Repo-wide lint/typecheck/tests | S1 | `npm run lint && npm run typecheck && npm test` (S1 fallback: see Step 1) |
| Sync deterministic + no drift (incl. untracked) | S2 | `npm run agents:sync && git diff --exit-code .opencode/agents .agents/agents .agents/skills && (git status --porcelain .opencode/agents .agents/agents .agents/skills \| grep -q . && exit 1 \|\| true)` — exact wrapper implemented as `npm run agents:drift` in S2 |
| Agent/skill/command template valid | S2 | `npm run agents:check` (contents per §3) |
| Eval schema valid | S7 | `npm run eval:check` (≥1 check, valid agent, valid `requires_atlas_step`) |
| Optimizer proposals-only | S8 | **Process rule** (prompt scope + H2): optimizer output lands only in `harness/proposals/`; verified by review, not by CI grep of authorship |
| CI guards | S9 | (a) generated-zone change requires a change to some canonical input (`agents/**`, root `skills/**`, `harness/shared-context.md`, `harness/tool-map.json`, `harness/antigravity-tools.json`, `harness/sync.mjs`); (b) PR touching `harness/eval/tasks/**` or `results.jsonl` **together with** `agents/**`|`harness/shared-context.md`|`.agents/**` → fail (prevents weakening the grading checks while editing agents) |
| No runtime format guessing | all | GENERATED headers present |

## 5. Dependency graph

```
Precondition §0: plans branch merged, harness plan committed, bootstrap commit exists

S1 scaffold ─→ { S2 sync+validate+export , S3 canonical skills }   (parallel, disjoint)
{S2, S3} ─→ { S4 agents-A , S5 agents-B }                          (parallel; skill refs must resolve)
{S4, S5} ─→ H1 human gate (releases BOTH as one unit)
H1 ─→ S6 shared-context final + command/workflow pairs
{S3, S6}? — S6 needs S3 only via workflow→skill references → edge: S3 ─→ S6 (ensured by {S2,S3}→…→H1→S6 chain; explicit for cold-start)
S6 ─→ S7 eval suite
S7 ─→ { S8 debugger+optimizer ─→ H2 gate , S9 CI (AFTER atlas Step 10) }   (parallel)
{H2, S9} ─→ S10 docs + global export walkthrough
```

**File ownership:** S1 `harness/` skeleton, `agents/README.md` (restated pattern), `plans/INDEX.md` (Gate column + harness row), package.json script slots (additive only) · S2 `harness/{sync.mjs,validate.mjs,export.mjs,tool-map.json,antigravity-tools.json,format-notes.md,test/}`, vitest config include-globs (**additive** — shared with atlas Step 1), generated zones via sync · S3 canonical **root `skills/**` only** · S4 `agents/{orchestrator,architect,reviewer}.md` · S5 `agents/{backend-dev,frontend-dev,test-writer}.md` · S6 `harness/shared-context.md`, `.opencode/commands/**`, `.agents/workflows/**` · S7 `harness/eval/**` · S8 `agents/{debugger,optimizer}.md` + `harness/proposals/` (runtime) · S9 `.github/workflows/**` · S10 `README.md`, `harness/README.md`. **`harness/format-notes.md`: owned by S2, explicit append rights for S7 + S10.**

**Parallel-pair guarantee:** {S2,S3}, {S4,S5}, {S8,S9} share zero files. Cross-plan shared files: root `package.json` scripts + vitest config = additive-edit exceptions (mirrored in atlas plan §5/Step 1).

**Model tiers:** strongest S2 (emission correctness hits both CLIs) and S6 (loaded by everything); default elsewhere; S8 default + H2.

## 6. Steps

### S1 — Scaffold

**Context:** Creates the pattern's shape + contracts every later step obeys.
**Tasks:**
- [ ] Dirs: `agents/`, `skills/`, `harness/{eval/{tasks,results,checks},proposals,test/fixtures}`, `.opencode/`, `.agents/` placeholders
- [ ] `agents/README.md`: **restate the full pattern** (7-question template with definitions for each section, frontmatter schema per §3, one-owner rule, roster-change rule: "a 9th agent requires documented repeated-failure evidence from `results.jsonl` + log entry here")
- [ ] `harness/shared-context.md` draft (≤6 KB): repo map, atlas plan pointer + invariants, ownership table, escalation protocol
- [ ] `harness/tool-map.json` + `harness/antigravity-tools.json` drafts (finalized S2)
- [ ] Root package.json script slots (additive): `agents:sync`, `agents:check`, `agents:drift`, `agents:export`, `eval:check`, `eval:run`
- [ ] Extend `plans/INDEX.md`: add **Gate** column; add row for this plan
- [ ] `.gitignore`: `harness/eval/*.tmp` (`results.jsonl` IS committed)
- [ ] **Fallback (if atlas Step 1's `package.json`/lint scripts not yet present — plans merge done, code commit pending):** also scaffold minimal `package.json` + `lint/typecheck/test` script stubs, and degrade this step's verify accordingly (dir checks + `wc -c` only); full invariants activate when atlas Step 1 lands

**Verify:** `npm run lint && npm run typecheck && npm test` green (or degraded fallback checks); dirs exist; shared-context ≤ 6 KB; INDEX shows Gate column + 2 rows.
**Exit:** contracts in place; S1-scoped invariants green.

### S2 — Sync engine + validator + export  ⚑ strongest

**Context:** Owns the generator both CLIs depend on. **First task:** verify Antigravity flat-skill shape + exact tool names — if `agy` is installed, confirm from its docs/help; else use documented set (`view_file, replace_file_content, run_command, grep_search, manage_task, …`) and record `untested against live CLI` + doc URLs + fetch date in `format-notes.md`.
**Tasks:**
- [ ] `harness/sync.mjs`: agents → both native files (OpenCode: description/mode/temperature/steps/permission derived from tools+owns via tool-map, incl. `task` allow-list for orchestrator; Antigravity: name/description/tools[]/tier→model/`mainAgent`+`subagent` from mode/`commandExecutionPolicy` per role/`skills` path map); skills → **both shapes** in `.agents/skills/`; shared-context inlined into agent prompts; GENERATED headers; deterministic
- [ ] `harness/validate.mjs` per §3 `agents:check` definition (incl. commands/workflows parity check — validates whatever files exist, order-independent)
- [ ] `agents:drift` script: the exact §4 wrapper (sync + `git diff --exit-code` + parenthesized porcelain clause — shell precedence bug of the naive `&&`/`||` chain is WHY it's parenthesized)
- [ ] `harness/export.mjs` with `--dry-run`; wire `agents:export`
- [ ] Vitest: round-trip fixtures (2 fake agents + 1 fake skill → snapshot all 5 outputs), invalid-tool rejection, budget violation, parity-mismatch rejection
- [ ] **Extend vitest include globs to `harness/test/`** (additive edit to shared config — ownership claimed in §5)
- [ ] `format-notes.md` (owner)

**Verify:** `npm run agents:check && npm test` green on empty roster (sync of 0 = no outputs; diff + porcelain checks pass); fixture sync snapshot matches; misspelled Antigravity tool → validate fails; `agents:export --dry-run` prints target paths.
**Exit:** engine + validator + export trusted; CI-ready commands exist.

### S3 — Canonical skills (parallel with S2)

**Context:** Owns root `skills/**` ONLY. No edits to `validate.mjs` (S2-owned; it validates skills whatever their count — order-independent). Skills become discoverable via S2's emission.
**Tasks:**
- [ ] `skills/blueprint-execution/SKILL.md` — cold-execute a `plans/*.md` step: context brief → tasks → verify → exit criteria; mutation protocol
- [ ] `skills/atlas-data-conventions/SKILL.md` — generated vs hand-authored data, determinism, `metadata.yaml` ground truth, unknown-status badge rule
- [ ] `skills/view-patterns/SKILL.md` — canvas/parity-test pattern, BASE_URL fetch rule, view file-ownership
- [ ] `skills/content-authoring/SKILL.md` — glossary/workflow/arch schemas + regions.json anchors
- [ ] `skills/review-checklist/SKILL.md` — anti-pattern watchlists of both plans

**Verify (self-contained, no dependency on S2):** shell loop — for each `skills/*/SKILL.md`: dir name matches `^[a-z0-9]+(-[a-z0-9]+)*$`, frontmatter contains `name:` equal to dir name and `description:` ≤1024 chars (`grep`/`awk`). Full integration asserted when `agents:check` runs after {S2,S3} both merge.
**Exit:** ≥5 canonical skills; shell assertions green. Full discoverability claim: **conditional** — if `agy` available, confirm listing; else "paths conform to documented layout" (softened, no false claim).

### S4 — Agents A: orchestrator, architect, reviewer (parallel with S5)

**Context:** After {S2, S3} (skill refs must resolve). Each file follows `agents/README.md`.
**Tasks:**
- [ ] `agents/orchestrator.md` — plan/delegate/verify only, never writes code; tools: read/glob/grep/task; outputs task breakdowns with one owner per file-set; escalation: unblock-or-abstain. Synced OpenCode file must carry `permission: {edit: deny, bash: deny, task: {allow-list of the other 7}}`
- [ ] `agents/architect.md` — design decisions only, read-only; writes ADRs via orchestrator, not itself
- [ ] `agents/reviewer.md` — never authors the change it reviews; read-only + bash allow-list `npm run *` (values `allow|ask|deny` per §2); quality bar = both plans' watchlists
- [ ] Sync; commit generated outputs; PR shows generated diff

**Verify:** `npm run agents:check && npm test`; spot-check both generated formats against §2 fields.
**Exit:** 3 agents valid + synced. **DO NOT merge — H1 holds this PR together with S5.**

### S5 — Agents B: backend-dev, frontend-dev, test-writer (parallel with S4)

**Context:** Same contract as S4; these carry atlas file-ownership into their Scope.
**Tasks:**
- [ ] `agents/backend-dev.md` — owns `extractor/**`, `packages/schema/**`; quality bar = atlas §4 invariants for extractor steps + determinism
- [ ] `agents/frontend-dev.md` — owns `atlas/**`; quality bar = build + bundle budget + BASE_URL rules
- [ ] `agents/test-writer.md` — owns `**/*.test.ts` + fixtures; OpenCode sync emits glob-scoped `edit` from `owns`; Antigravity prompt-scoped (documented)
- [ ] Sync; commit generated outputs

**Verify:** `npm run agents:check && npm test`.
**Exit:** 6 canonical agents + 6 generated outputs, all valid. **DO NOT merge — H1 holds this PR together with S4.**

### H1 — Human gate (blocks S6; releases S4+S5 as one unit)

**Tasks:**
- [ ] Present: roster table (name, one-liner, owns, tools, skills) + Scope/escalation excerpts + generated-diff summary for ALL 6
- [ ] question tool → approve or request tweaks; apply to canonical; re-sync
- [ ] Record approval in `plans/INDEX.md` Gate column

**Exit:** explicit user approval recorded; S4+S5 merged together.

### S6 — Shared-context final + command/workflow pairs

**Context:** After H1 (and S3 via chain). Re-sync re-inlines shared-context everywhere.
**Tasks:**
- [ ] Finalize `harness/shared-context.md` — reviewer-pass: every path/term exists in repo or plans/; re-sync
- [ ] Pairs with identical names (parity auto-checked by `agents:check`): `/plan-step <n>` (OpenCode `$ARGUMENTS` ↔ Antigravity prose), `/review-diff` (OpenCode `agent: reviewer, subtask: true`), `/propose-opt` (stub until S8)
- [ ] Cross-refs: workflow bodies reference only existing agent names + canonical skill names

**Verify:** `npm run agents:check` green (re-inline within budget; parity check covers command/workflow pairs incl. `description` frontmatter); if `agy` available, confirm `/plan-step` listed — else "layout conforms" (soft claim).
**Exit:** parity green on both sides (or conformance-only where `agy` unavailable, recorded).

### S7 — Eval suite (18 tasks + runner)  ⚑ verify invocation path

**Context:** After S6. Every task mechanically checkable. **Atlas-progress dependency handled by tags, not blocking.**
**Tasks:**
- [ ] Task schema + `npm run eval:check` (≥1 check, valid agent, valid `requires_atlas_step` ∈ {1,2a,2b,3,4,5,6,7,10,none})
- [ ] `harness/eval/run.mjs [--task T07]`: **temp git worktree for `setup`** → document/attempt agent invocation → run checks → append `results.jsonl` → teardown asserts `git status --porcelain` empty (fails if planted bug leaks)
- [ ] **18 tasks** (9 categories ×2), each tagged `requires_atlas_step`:
  | Category | example check | typical tag |
  |---|---|---|
  | plan-cold-start | output contains step's exact verify command | none |
  | extractor-fix | `npm run extract && npm test` green | 2a |
  | schema-fix | planted type error fixed → `typecheck` green | 2a |
  | content-author | anchor assertion passes | 3 |
  | view-parity | new parity test exists AND passes | 5 |
  | review-catch | planted bug → reviewer output greps marker | none (fixture) |
  | debug-repro | planted failing test green; `git diff --name-only` scoped | 2a |
  | escalation | output contains `ESCALATE:` line | none |
  | optimizer-proposal | proposal lands in `harness/proposals/` w/ before/after eval cmds | 7 |
- [ ] **Verify invocation:** try `opencode run --agent <n> "…"` and `agy` non-interactive; record honestly in `format-notes.md`; if neither: runner = checks-only + README manual loop (anti-pattern 12)
- [ ] Run all tasks whose checks pass against current repo state (tag `none` + tags already reached) → green

**Verify:** `npm run eval:check` green; `npm run eval:run` on runnable-now subset → all pass; deliberately broken check → correctly fails; teardown test: planted bug does NOT leak (`git status --porcelain` empty after run).
**Exit:** 18 tagged tasks; **runnable-now subset (≥8: plan-cold-start, review-catch, escalation, + whatever atlas progress allows) all green**; runner real; invocation capability documented honestly.

### S8 — Debugger + optimizer → H2

**Context:** After S7 (needs results + runner).
**Tasks:**
- [ ] `agents/debugger.md` — reproduce-first; Scope: never fix beyond repro'd root cause without orchestrator sign-off
- [ ] `agents/optimizer.md` — reads `results.jsonl`; outputs diff proposals to `harness/proposals/` ONLY; MUST embed before/after eval evidence; scope forbids `agents/**`, generated zones, `harness/eval/**`, `results.jsonl` (cannot rewrite its own grading)
- [ ] Sync; commit outputs
- [ ] **End-to-end proof:** run `debug-repro` and `optimizer-proposal` tasks once against the real roster (manual or programmatic per S7 findings) → append real entries to `results.jsonl`
- [ ] **H2:** present optimizer constraints + proposal workflow → approval → `plans/INDEX.md` Gate column

**Verify:** `npm run agents:check && npm test`; the two real `results.jsonl` entries pass.
**Exit:** 8/8 roster; two end-to-end eval entries green; H2 approved.

### S9 — CI wiring (parallel with S8; ordered AFTER atlas Step 10)

**Context:** After S7. Touches only `.github/workflows/`.
**Tasks:**
- [ ] Extend atlas-created `ci.yml` (or create minimal fallback per §0 with `# harness-fallback` marker): `agents:check`, `eval:check` on PRs
- [ ] Guard (a) per §4: generated-zone diff ⇄ canonical-input diff co-requirement (canonical set: `agents/**`, root `skills/**`, `harness/shared-context.md`, `harness/tool-map.json`, `harness/antigravity-tools.json`, `harness/sync.mjs`)
- [ ] Guard (b) per §4: `harness/eval/tasks/**`|`results.jsonl` co-change with agent-side files → fail
- [ ] Optional nightly: `eval:run` check-only subset → results update via bot PR (never direct push)

**Verify:** red-path PR (hand-edit a generated file alone) → CI fails; red-path PR (edit a task + an agent together) → CI fails; normal PR → green.
**Exit:** guards live; no collision with atlas Step 10 (ordering + fallback marker honored).

### S10 — Docs + global export

**Context:** After H2 + S9.
**Tasks:**
- [ ] `harness/README.md`: canonical→sync→two-CLIs diagram; human-gate workflow; roster-change rule; **command/workflow parity table**; known asymmetries → `format-notes.md` pointers
- [ ] Root `README.md`: run the team in OpenCode (`opencode`, Tab to orchestrator, `/plan-step N`) and Antigravity (`agy`, `/agents` panel, `/plan-step`)
- [ ] Global export walkthrough: `npm run agents:export -- --cli <x>` (+ `--dry-run`) → `~/.config/opencode/agents/` / `~/.gemini/config/agents/` (script from S2; prompts before overwrite)
- [ ] Append rights: `format-notes.md` maintenance note (re-verify doc URLs on CLI updates)
- [ ] **Conditional agy smoke:** if installed, list exported agents + skills live; else record "not verified against live Antigravity CLI" (honest claim)

**Verify:** fresh-clone: `npm i && npm run agents:check && npm run eval:check` green; `agents:export --dry-run` prints targets.
**Exit:** blueprint complete; team operational (or explicitly documented as OpenCode-verified/Antigravity-conformance-only).

## 7. Anti-pattern watchlist (reviewer: check each)

1. **Two owners for one file** — §5 table; PR touching non-owned file rejected (orchestrator's verification duty)
2. **Orchestrator doing the work** — `edit/bash: deny` enforced on OpenCode; prompt-enforced on Antigravity (asymmetry documented)
3. **Self-review** — reviewer never authors the change it reviews
4. **Optimizer self-approval** — proposals-only; H2 human applies; CI never auto-merges `agents/**`
5. **Roster creep** — 8 frozen; additions need `results.jsonl` evidence + `agents/README.md` log
6. **Shared-context bloat** — 6 KB validator cap
7. **Antigravity tool-name typo → hang** — whitelist hard-fail (S2 verifies live where possible)
8. **Hand-edited generated files** — GENERATED headers + CI guard (a) + drift `git status --porcelain`
9. **Uncheckable eval tasks** — schema requires ≥1 shell check
10. **Prompt divergence** — one canonical body per agent/skill; nobody edits outputs
11. **Hardcoded provider model ids** — tier-only mapping
12. **Faked automation** — unverified invocation → documented manual loop, never false claims
13. **Inlined shared-context drift** — every sync re-inlines; staleness caught by determinism check
14. **Optimizer rewriting its own grading** — scope forbids `harness/eval/**` + `results.jsonl`; CI guard (b) blocks agent+eval co-edits in one PR
15. **Command/workflow parity drift** — name-set + frontmatter equality enforced mechanically in `agents:check`, not just a doc table
16. **Planted-bug leakage** — eval `setup` runs in temp worktree; teardown asserts clean `git status --porcelain`
17. **Cross-plan CI overwrite** — S9 ordered after atlas Step 10 + fallback marker + mirrored note in atlas plan

## 8. Risks & rollback

| Risk | Mitigation |
|---|---|
| Antigravity skill shape/tool names differ from docs | Dual-shape emission (F1 fix); S2 live verification where possible; conformance-only claims otherwise (S3/S6/S10 softened exits) |
| Programmatic agent invocation unavailable | S7 fallback = check-runner + manual loop (anti-pattern 12) |
| S7 tasks exceed current atlas progress | `requires_atlas_step` tags; S7 exit = runnable-now subset (≥8) green; S8 runs 2 end-to-end |
| Both CLIs' formats change | `format-notes.md` URLs + dates; sync engine isolates change |
| Optimizer prompt-injection via `results.jsonl` | reads structured fields only; proposals are human-reviewed diffs (H2 standing rule) |
| Sync bug breaks both CLIs at once | S2 fixtures + snapshots before any real agent; H1 inspects generated diffs |

Rollback: revert merge commit per step; S4/S5/S8 disjoint; S9 guards independently removable.

## 9. Mutation protocol (during execution)

- **Split:** >600 lines of any code → split by §5 ownership, log here
- **Skip:** `SKIPPED: <step> — covered by <step>` (exit criteria genuinely met elsewhere)
- **Reorder:** dependency edge must hold; update §5 in same PR (S9 may never precede atlas Step 10 without the fallback marker)
- **Abandon:** `ABANDONED: <step> — <reason>`, cascade-check dependents (S2 especially — everything downstream depends on it)
- **Roster change:** repeated-failure evidence + `agents/README.md` log + human approval

## 10. Execution log

| Date | Change |
|---|---|
| 2026-10-01 | Blueprint drafted. Decisions: canonical+sync, 8-agent roster, 18-task eval. Research: OpenCode agents/skills/commands docs + Antigravity subagents/commands/workflows docs fetched |
| 2026-10-01 | Review r1: 28 findings (8 critical, 13 major, 7 minor) — all applied: dual-shape skill emission, DAG edges {S2,S3}→{S4,S5} and H1→S6, S3 decoupled from validate.mjs, CI canonical-input guard set, agents:export implemented in S2, cross-plan fixes mirrored into atlas plan (package.json exception, bootstrap reality, Step-10 dedup), eval `requires_atlas_step` tags + worktree teardown, S8 end-to-end proof runs, format-notes ownership, parity check in agents:check, INDEX Gate column, permission values grounded, roster-count wording, vitest include globs |
| 2026-10-01 | Review r2: 6 findings (3 major, 3 minor) — all applied: §0 commits all three plans files pre-merge, atlas §5 exception extended to vitest include-globs, drift-command shell precedence fixed + `agents:drift` script added to S1 slots and S2 tasks, atlas Step-10 cross-ref §5→§0/S9, S1 fallback trigger reworded, INDEX gate wording H1 (after S4+S5) |
