import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDecisionStore } from '@/application/useDecisionStore'
import {
  buildDecisionCompareRows,
  computeOutcomeMatrix,
} from '@/domain/intelligence'
import { buildLearningSurfaces } from '@/domain/learningSurfaces'

export function InsightsPage() {
  const { decisions } = useDecisionStore()
  const matrix = useMemo(() => computeOutcomeMatrix(decisions), [decisions])
  const learning = useMemo(() => buildLearningSurfaces(decisions), [decisions])
  const reviewed = decisions.filter((d) => d.review)
  const [selected, setSelected] = useState<string[]>([])

  const compareRows = buildDecisionCompareRows(decisions, selected)
  const totalReviewed = reviewed.length

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 4
          ? prev
          : [...prev, id],
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Patterns</p>
        <h1>Insights</h1>
        <p className="lede">
          Deterministic views across accumulated history. Association only —
          not causality, not a life score. Sample sizes always shown.
        </p>
      </header>

      <section className="signal-grid">
        <article className="signal-card">
          <h2>Library</h2>
          <p className="signal-count">{learning.sampleSizes.decisions}</p>
        </article>
        <article className="signal-card">
          <h2>Committed</h2>
          <p className="signal-count">{learning.sampleSizes.committed}</p>
        </article>
        <article className="signal-card">
          <h2>Reviewed</h2>
          <p className="signal-count">{learning.sampleSizes.reviewed}</p>
        </article>
        <article className="signal-card">
          <h2>With lineage</h2>
          <p className="signal-count">{learning.sampleSizes.withLineage}</p>
        </article>
      </section>

      <section className="panel">
        <h2>Decision × outcome matrix</h2>
        <p className="muted">Reviewed decisions: n={totalReviewed}</p>
        <div className="matrix-grid">
          {matrix.map((q) => (
            <article key={q.id} className="matrix-card">
              <h3>{q.label}</h3>
              <p className="signal-count">{q.sampleSize}</p>
              <p className="muted">{q.description}</p>
              <ul>
                {q.decisions.slice(0, 4).map((d) => (
                  <li key={d.id}>
                    <Link to={`/decisions/${d.id}`}>
                      {d.title} (D{d.decisionQ}/O{d.outcomeQ})
                    </Link>
                  </li>
                ))}
                {!q.decisions.length ? (
                  <li className="muted">No samples</li>
                ) : null}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Quality over time</h2>
        <p className="muted">
          n={learning.qualityTrend.length} reviewed · chronological by review
          date
        </p>
        {learning.qualityTrend.length ? (
          <div className="compare-table-wrap">
            <table className="compare-table">
              <caption>Decision quality vs outcome quality</caption>
              <thead>
                <tr>
                  <th scope="col">Reviewed</th>
                  <th scope="col">Decision</th>
                  <th scope="col">Decision Q</th>
                  <th scope="col">Outcome Q</th>
                </tr>
              </thead>
              <tbody>
                {learning.qualityTrend.slice(-24).map((r) => (
                  <tr key={`${r.decisionId}-${r.reviewedAt}`}>
                    <td>{r.reviewedAt.slice(0, 10)}</td>
                    <th scope="row">
                      <Link to={`/decisions/${r.decisionId}`}>{r.title}</Link>
                    </th>
                    <td>{r.decisionQuality}</td>
                    <td>{r.outcomeQuality}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No reviews yet.</p>
        )}
      </section>

      <section className="panel">
        <h2>High-confidence misses</h2>
        <p className="muted">
          Fingerprint-true evaluations where confidence was ≥70%. n=
          {learning.highConfidenceMisses.length} shown (capped).
        </p>
        <ul className="entity-list">
          {learning.highConfidenceMisses.map((m, i) => (
            <li key={`${m.decisionId}-${i}`} className="emphasis-fail">
              <span className="pill">{m.kind}</span>
              <strong>{m.statement}</strong>
              <span>
                {m.confidence}% ·{' '}
                <Link to={`/decisions/${m.decisionId}`}>{m.title}</Link>
              </span>
            </li>
          ))}
          {!learning.highConfidenceMisses.length ? (
            <li className="muted">None</li>
          ) : null}
        </ul>
      </section>

      <section className="panel">
        <h2>Revision intensity</h2>
        <dl className="kv">
          <div>
            <dt>Mean revisions (committed)</dt>
            <dd>{learning.revisionIntensity.meanRevisionsAmongCommitted}</dd>
          </div>
          <div>
            <dt>Max revisions</dt>
            <dd>{learning.revisionIntensity.maxRevisions}</dd>
          </div>
          <div>
            <dt>≥3 revisions</dt>
            <dd>{learning.revisionIntensity.decisionsWithThreePlus}</dd>
          </div>
        </dl>
        <ul className="entity-list">
          {learning.substantialBeliefChanges.slice(0, 8).map((r) => (
            <li key={r.decisionId}>
              <Link to={`/decisions/${r.decisionId}`}>{r.title}</Link>
              <span>
                {r.revisionCount} revisions · {r.note || '—'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Memory drift reviews</h2>
        <ul className="entity-list">
          {learning.memoryDriftReviews.map((r) => (
            <li key={`${r.decisionId}-${r.reviewedAt}`}>
              <Link to={`/decisions/${r.decisionId}`}>{r.title}</Link>
              <span className="muted">{r.reviewedAt.slice(0, 10)}</span>
              <p>{r.notes}</p>
            </li>
          ))}
          {!learning.memoryDriftReviews.length ? (
            <li className="muted">None recorded</li>
          ) : null}
        </ul>
      </section>

      <section className="panel">
        <h2>Unresolved historical propositions</h2>
        <p className="muted">
          Registry entries without a fingerprint-matched evaluation yet. n=
          {learning.unresolvedPropositions.length} shown (capped).
        </p>
        <ul className="entity-list">
          {learning.unresolvedPropositions.slice(0, 12).map((u, i) => (
            <li key={`${u.decisionId}-${i}`}>
              <span className="pill">{u.kind}</span>
              <span className="pill">{u.provenance}</span>
              <strong>{u.statement}</strong>
              <Link to={`/decisions/${u.decisionId}`}>{u.title}</Link>
            </li>
          ))}
          {!learning.unresolvedPropositions.length ? (
            <li className="muted">None</li>
          ) : null}
        </ul>
      </section>

      <section className="panel">
        <h2>Assumption families</h2>
        <p className="muted">
          User-confirmed only — never auto-merged. Families:{' '}
          {learning.families.length}
        </p>
        <ul className="entity-list">
          {learning.families.slice(0, 10).map((f) => (
            <li key={f.familyId}>
              <strong>{f.familyLabel}</strong>
              <span>
                {f.memberCount} members · {f.distinctFingerprints} distinct
                fingerprints
              </span>
            </li>
          ))}
          {!learning.families.length ? (
            <li className="muted">
              Assign a family label on a decision&apos;s assumption to start.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="panel">
        <h2>Compare decisions</h2>
        <p className="muted">Select up to 4 reviewed or committed decisions.</p>
        <ul className="compare-pick">
          {decisions.slice(0, 12).map((d) => (
            <li key={d.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(d.id)}
                  onChange={() => toggle(d.id)}
                />
                {d.title}
              </label>
            </li>
          ))}
        </ul>
        {compareRows.length ? (
          <div className="compare-table-wrap">
            <table className="compare-table">
              <caption>Side-by-side pattern fields</caption>
              <thead>
                <tr>
                  <th scope="col">Decision</th>
                  <th scope="col">Mean pred. conf. (then)</th>
                  <th scope="col">Assumptions</th>
                  <th scope="col">Predictions</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Decision Q</th>
                  <th scope="col">Days to review</th>
                  <th scope="col">Revisions</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">
                      <Link to={`/decisions/${r.id}`}>{r.title}</Link>
                    </th>
                    <td>
                      {r.meanPredictionConfidence === null
                        ? '—'
                        : `${Math.round(r.meanPredictionConfidence)}%`}
                    </td>
                    <td>{r.assumptionCount}</td>
                    <td>{r.predictionCount}</td>
                    <td>{r.outcomeQuality ?? '—'}</td>
                    <td>{r.decisionQuality ?? '—'}</td>
                    <td>{r.daysToReview ?? '—'}</td>
                    <td>{r.revisionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Select decisions to compare.</p>
        )}
      </section>
    </div>
  )
}
