# BranchBack

A notebook for decisions. It remembers what you thought *before* the result
came in. **v2.0.0**.

Open it months later and you can still see the belief you actually held, not
the story you tell yourself now.

No accounts. No cloud. No AI recommendations. Data stays in this browser
(IndexedDB).

## Requirements

- **Node.js ≥ 24** (see `package.json` `engines`, `.nvmrc`, `.node-version`)
- `engine-strict=true` — installs fail loudly on unsupported Node

```bash
npm ci
npm run dev
```

Load the guided demo from Home.

## What BranchBack preserves

| Layer | Meaning |
|-------|---------|
| **Known Then** | Immutable commit snapshot |
| **Revisions** | Authentic later working states |
| **Known Now** | Current working copy |
| **Historical propositions** | Fingerprint registry across commit + revisions + working |
| **Reviews** | Outcome vs decision quality; fingerprint-bound evaluations |
| **Lineage / evidence** | Append + tombstone — accepted records cannot silently vanish |
| **Belief families** | User-confirmed only |

## Screenshots

| View | File |
|------|------|
| Home | `docs/screenshots/home.png` |
| Library | `docs/screenshots/library.png` |
| Calibration | `docs/screenshots/calibration.png` |
| Insights | `docs/screenshots/insights.png` |

## Commands

```bash
npm test
npm run build
npm run test:e2e
npm run test:e2e:offline
npm run verify:v2
```

See `VERIFICATION.md`, `RELEASE_NOTES.md`, `KNOWN_LIMITATIONS.md`.

## License

MIT — see `LICENSE`.
