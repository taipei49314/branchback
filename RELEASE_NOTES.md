# Release notes — BranchBack v2.0.0

BranchBack is a local-first decision replay laboratory. v2 adds an accumulated-history
layer while extending the same historical-truth standard to lineage and evidence.

## Highlights

- Lineage links and evidence references cannot silently vanish after acceptance (tombstones)
- Evidence shows claimed availability separately from recorded-at provenance
- History explorer/search and dossiers keep temporal layers distinguishable
- Backup health states align with import validity
- Scale gate includes 100 and 500 synthetic decisions

## Install

Node ≥ 24 required.

```bash
npm ci
npm run dev
```

## Verify

```bash
npm run verify:v2
```

See `VERIFICATION.md`.
