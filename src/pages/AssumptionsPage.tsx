import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useDecisionStore } from '@/application/useDecisionStore'
import { analyzeAssumptions } from '@/domain/assumptionAnalytics'
import { summarizeAssumptionFamilies } from '@/domain/assumptionFamilies'

export function AssumptionsPage() {
  const { decisions } = useDecisionStore()
  const stats = analyzeAssumptions(decisions)
  const families = useMemo(
    () => summarizeAssumptionFamilies(decisions),
    [decisions],
  )
  const meaningfulRate =
    stats.totalAssumptions >= 5 && stats.failureRate !== null

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Patterns</p>
        <h1>Assumption analytics</h1>
        <p className="lede">
          Deterministic counts only. Look for statements that keep failing —
          especially when confidence was high. Belief families are
          user-confirmed — never silently merged.
        </p>
      </header>

      <section className="signal-grid">
        <article className="signal-card">
          <h2>Total assumptions</h2>
          <p className="signal-count">{stats.totalAssumptions}</p>
        </article>
        <article className="signal-card">
          <h2>Failed</h2>
          <p className="signal-count">{stats.failedAssumptions}</p>
        </article>
        <article className="signal-card">
          <h2>Failure rate</h2>
          <p className="signal-count">
            {stats.failureRate === null
              ? '—'
              : `${Math.round(stats.failureRate * 100)}%`}
          </p>
          <p className="muted">
            {meaningfulRate
              ? 'Sample size is large enough for a rough rate.'
              : 'Too little data for a stable failure-rate reading.'}
          </p>
        </article>
        <article className="signal-card">
          <h2>Confirmed families</h2>
          <p className="signal-count">{families.length}</p>
        </article>
      </section>

      <section className="panel">
        <h2>User-confirmed belief families</h2>
        <p className="muted">
          Distinct fingerprints inside a family remain distinct. Linking does
          not rewrite history.
        </p>
        <ul className="entity-list">
          {families.map((f) => (
            <li key={f.familyId}>
              <strong>{f.familyLabel}</strong>
              <span>
                {f.memberCount} members · {f.distinctFingerprints} fingerprints
              </span>
              <ul>
                {f.members.slice(0, 6).map((m) => (
                  <li key={`${m.decisionId}-${m.assumptionId}`}>
                    <Link to={`/decisions/${m.decisionId}`}>
                      {m.decisionTitle}
                    </Link>
                    : “{m.statement}” ({m.status}, {m.confidence}%)
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {!families.length ? (
            <li className="muted">
              Assign a family label on a decision workspace assumption to start.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="panel">
        <h2>Most frequently failed</h2>
        <ul className="entity-list">
          {stats.mostFrequentFailures.slice(0, 10).map((p) => (
            <li key={p.normalizedStatement}>
              <strong>“{p.normalizedStatement}”</strong>
              <span>
                failed {p.failedCount} / {p.occurrences} · across{' '}
                {p.decisionIds.length} decisions
              </span>
            </li>
          ))}
          {!stats.mostFrequentFailures.length ? (
            <li className="muted">No failed assumptions yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="panel">
        <h2>High-confidence failures (≥70%)</h2>
        <ul className="entity-list">
          {stats.highConfidenceFailures.map((h, i) => (
            <li key={`${h.decisionId}-${i}`} className="emphasis-fail">
              <strong>{h.statement}</strong>
              <span>
                then {h.confidence}% ({h.confidenceSource}) ·{' '}
                <Link to={`/decisions/${h.decisionId}`}>{h.decisionTitle}</Link>
              </span>
            </li>
          ))}
          {!stats.highConfidenceFailures.length ? (
            <li className="muted">None</li>
          ) : null}
        </ul>
      </section>

      <section className="panel">
        <h2>Reused across decisions (text match)</h2>
        <p className="muted">
          Normalized text reuse is a hint only — not a semantic merge.
        </p>
        <ul className="entity-list">
          {stats.reusedAcrossDecisions.map((p) => (
            <li key={p.normalizedStatement}>
              <strong>“{p.normalizedStatement}”</strong>
              <span>{p.decisionIds.length} decisions</span>
            </li>
          ))}
          {!stats.reusedAcrossDecisions.length ? (
            <li className="muted">No reused statements yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
