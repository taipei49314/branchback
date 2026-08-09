# BranchBack — North Star

## Mission

Build a local-first decision replay laboratory.

BranchBack helps users preserve what they actually believed at the moment a decision was made, then revisit that decision after reality unfolds.

The product must distinguish:

- decision quality
- reasoning quality
- assumption quality
- outcome quality

A good outcome must not automatically make a decision "good".

A bad outcome must not automatically make a decision "bad".

The system exists to fight hindsight distortion.

---

# Product Principle

BranchBack is not:

- a todo app
- a journal
- an AI adviser
- a prediction market
- a habit tracker
- a productivity dashboard

BranchBack is a structured record of decision states over time.

The user should be able to answer:

> What did I believe before I knew the outcome?

---

# v0.1 Product

Build a polished browser application.

Recommended stack:

- React
- TypeScript
- Vite
- IndexedDB
- Vitest
- Playwright
- modern accessible UI system

No backend is required.

The application must work offline.

---

# Core Entity — Decision

Every Decision must contain:

## Identity

- id
- title
- description
- createdAt
- decisionDate
- reviewDate
- status

Statuses:

- OPEN
- DECIDED
- REVIEW_DUE
- REVIEWED
- ARCHIVED

---

## Context

Record the known situation at decision time.

Fields:

- context
- constraints
- stakes
- deadline
- people involved
- optional tags

---

## Options

A Decision contains 2+ options.

Each option contains:

- title
- description
- perceived upside
- perceived downside
- estimated probability of success
- reasons for choosing
- reasons for rejecting

Exactly one option may later become the selected option.

---

# Assumptions

Users must be able to record assumptions separately from reasons.

Example:

> "I think customer demand will continue increasing."

Each assumption contains:

- statement
- confidence
- importance
- falsification condition
- later status

Status:

- UNKNOWN
- HELD
- FAILED
- PARTIAL
- UNTESTABLE

This distinction is critical.

---

# Predictions

Users can create explicit predictions.

Each prediction contains:

- statement
- expected result
- expected date
- confidence
- evaluation criteria

Example:

> "The prototype will be usable by ten people within 14 days."

When reviewing a decision, predictions can be marked:

- CORRECT
- INCORRECT
- PARTIAL
- UNKNOWN

---

# Decision Snapshot

Once the user finalizes a decision, create an immutable snapshot.

The original snapshot must never silently change.

If the user edits the decision later, preserve revision history.

The UI must clearly distinguish:

- what was known then
- what was added later

This is one of BranchBack's hardest requirements.

Do not fake immutability merely by disabling a button.

The data model must preserve historical revisions.

---

# Review Mode

When reviewDate arrives, the Decision becomes REVIEW_DUE.

The review experience asks:

## Reality

- What actually happened?
- What was unexpected?
- What information did you not have?
- Which assumptions failed?
- Which assumptions held?

## Outcome

Outcome rating:

1–5

This represents what happened.

## Decision Quality

Decision rating:

1–5

This represents whether the original decision was reasonable using information available at the time.

These ratings MUST remain separate.

---

# Hindsight Test

Before showing the user's original reasoning during a review, optionally ask:

> What do you remember believing at the time?

Then reveal the historical snapshot.

Show differences between:

- remembered reasoning
- actual recorded reasoning

Do not call the difference dishonesty.

Label it:

> Memory drift

---

# Branch Replay

Display the original options as branches.

Example:

```
                    Decision
                       │
          ┌────────────┼────────────┐
          │            │            │
       Option A      Option B     Option C
          │
        chosen
          │
        reality
```

The UI should let the user inspect rejected branches.

Do NOT pretend to know what would actually have happened had another option been chosen.

Unchosen branches must explicitly remain:

> Counterfactual — unknowable

Users may add notes about them, but the product must not represent speculation as fact.

---

# Calibration

Create a dashboard showing prediction confidence versus actual correctness.

Example buckets:

- 0–20%
- 21–40%
- 41–60%
- 61–80%
- 81–100%

The goal is to let users discover patterns such as:

> Decisions you describe as 90% certain are only correct 64% of the time.

Use honest statistical wording.

Do not produce strong conclusions from tiny datasets.

Show sample sizes.

---

# Assumption Analytics

Create analytics for:

- most frequently failed assumptions
- high-confidence failed assumptions
- assumptions reused across decisions
- assumption failure rate
- decisions affected by failed assumptions

This may reveal patterns such as:

> "Schedule estimates" repeatedly fail.

or

> "Other people will respond quickly" appears in six failed decisions.

Do not use AI for this.

Use deterministic tagging and statistics.

---

# Timeline

Provide a timeline view showing:

Decision created

→ Decision committed

→ Expected events

→ Review due

→ Actual events

→ Review

The timeline should make temporal relationships immediately understandable.

---

# Views

Minimum application views:

1. Home
2. Decisions
3. New Decision
4. Decision Detail
5. Decision Commit
6. Review
7. Timeline
8. Calibration
9. Assumptions
10. Settings

---

# Home

Home should answer:

- What decisions are currently open?
- What reviews are due?
- What predictions are awaiting outcomes?
- What assumptions are repeatedly failing?

Do not turn this into a generic productivity dashboard.

---

# Local First

v0.1 must have:

- no account
- no cloud
- no analytics service
- no backend
- no telemetry

Store data locally.

Use IndexedDB.

Provide:

- JSON export
- JSON import
- full backup
- Markdown export for individual decisions

---

# Demo Mode

Include a built-in demo dataset containing at least six realistic decisions from different domains:

- career
- finance
- relationships
- purchasing
- projects
- travel

Demo data must exercise:

- successful decision / good reasoning
- bad outcome / good reasoning
- good outcome / weak reasoning
- failed assumptions
- inaccurate prediction
- memory drift

The demo should make the product understandable within 60 seconds.

---

# UX Requirements

This project is frontend-heavy.

Do not ship a CRUD admin interface.

The interface should visually emphasize:

- branching
- time
- uncertainty
- confidence
- assumptions
- revealed reality

The UI must feel like a decision laboratory.

It must work well on desktop and mobile.

---

# Accessibility

Target WCAG 2.2 AA where practical.

Required:

- complete keyboard navigation
- visible focus state
- semantic forms
- accessible dialogs
- no color-only status indication
- chart text alternatives
- reduced-motion handling

---

# Engineering Quality

Required:

- TypeScript strict mode
- deterministic domain logic
- schema validation
- migration-capable local storage
- unit tests
- integration tests
- Playwright E2E tests

Core domain logic must not live inside React components.

Separate:

```
src/
  domain/
  storage/
  application/
  components/
  features/
  pages/
  visualization/
```

---

# Minimum Test Scenarios

Must test:

1. Create decision
2. Add multiple options
3. Add assumptions
4. Add predictions
5. Commit decision
6. Snapshot cannot be silently overwritten
7. Revision creates history
8. Review decision
9. Compare outcome and decision quality
10. Mark assumptions held/failed
11. Evaluate predictions
12. Export
13. Import
14. Data survives reload
15. Demo dataset loads correctly
16. Keyboard-only critical flow

---

# Prohibited Scope for v0.1

Do NOT add:

- LLMs
- AI recommendations
- authentication
- cloud sync
- collaboration
- social feeds
- subscriptions
- blockchain
- external databases

Do not expand scope because another feature appears interesting.

Finish the product first.

---

# Completion Definition

Do not claim COMPLETE unless:

- fresh install works
- production build succeeds
- automated test suite succeeds
- E2E critical path succeeds
- demo mode works
- export/import round trip works
- application works offline
- README accurately reflects current behavior

Provide actual command output as evidence.

If something cannot be verified, mark it NOT_VERIFIED.

---

# Cursor Autonomy

You own implementation decisions inside this North Star.

Do not ask the user to choose:

- component library
- state library
- file naming
- icon set
- minor interaction behavior
- directory implementation details

Choose reasonable solutions and continue.

Ask only when a decision would materially change the product mission.

Otherwise, keep building.

---

# Historical authority (M0.1–M0.3)

Once BranchBack has accepted something as historical record, no ordinary later write may silently alter or erase that history.

Ordinary application code cannot bypass `DecisionRepository` (no exported DB handle / raw put API).

Post-commit changes to revision-tracked working fields require exactly one authentic revision capturing the previously persisted state. See `docs/HISTORY_MODEL.md`.

Import modes:

- `merge` — upsert; never deletes
- `replace` — full restore only if no committed decision would be omitted
- `destructive-wipe` — requires `confirmEraseExistingHistory: true`

---

# First Milestone

Deliver M0:

- repository architecture
- domain schema
- IndexedDB persistence
- Decision creation flow
- option editor
- assumption editor
- prediction editor
- immutable commit snapshot
- Decision detail page
- six-decision demo dataset
- tests for domain invariants

Do not spend the entire milestone polishing the landing page.

A functioning decision lifecycle has priority.

---

# Integrity (M0.1)

What BranchBack says the user believed then cannot be silently rewritten by a later ordinary application write.

Runtime object freezing is not sufficient. Persistence, import, merge, replace, revision, and review paths must enforce historical snapshot integrity.

If a later review is recorded, prior review content must remain distinguishable history — not a silent overwrite.

---

# North Star Sentence

At any point in development, ask:

> Does this help preserve the difference between what the user believed then and what they know now?

If not, it probably does not belong in BranchBack.
