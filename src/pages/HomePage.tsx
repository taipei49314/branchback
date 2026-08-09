import { Link } from 'react-router-dom'
import { useDecisionStore } from '@/application/useDecisionStore'
import { buildAttentionBoard } from '@/domain/attention'
import { StatusBadge } from '@/components/StatusBadge'

export function HomePage() {
  const { decisions, loading, loadDemo, error } = useDecisionStore()
  const board = buildAttentionBoard(decisions)
  const isEmpty = !decisions.length

  return (
    <div className="page">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <header className="hero-lab">
        <p className="eyebrow">Local-first laboratory</p>
        <h1>BranchBack</h1>
        <p className="lede">
          What deserves your attention now — without rewriting what you believed
          then.
        </p>
        <div className="hero-actions">
          <Link className="btn primary" to="/decisions/new">
            New decision
          </Link>
          {isEmpty ? (
            <button
              type="button"
              className="btn"
              onClick={() => void loadDemo()}
              disabled={loading}
            >
              Start guided demo
            </button>
          ) : (
            <Link className="btn" to="/decisions">
              Browse library
            </Link>
          )}
          <Link className="btn" to="/insights">
            Insights
          </Link>
        </div>
      </header>

      {isEmpty ? (
        <section className="panel tour-panel" aria-label="Guided entry">
          <h2>Five minutes to understand BranchBack</h2>
          <ol className="tour-steps">
            <li>
              <strong>Known Then</strong> — commit freezes what you believed
              before the outcome.
            </li>
            <li>
              <strong>Outcome ≠ decision quality</strong> — rate them separately
              in Review.
            </li>
            <li>
              <strong>Memory Drift</strong> — recall first, then compare to the
              record.
            </li>
            <li>
              <strong>Calibration</strong> — see whether stated confidence
              matched scored predictions (with sample sizes).
            </li>
          </ol>
          <button
            type="button"
            className="btn primary"
            onClick={() => void loadDemo()}
            disabled={loading}
          >
            Load six-decision demo
          </button>
        </section>
      ) : null}

      <section className="signal-grid" aria-label="Needs attention">
        <AttentionCard
          title="Open decisions"
          count={board.open.length}
          empty="None open"
          items={board.open.slice(0, 4).map((d) => ({
            id: d.id,
            to: `/decisions/${d.id}`,
            label: d.title,
          }))}
        />
        <AttentionCard
          title="Reviews due"
          count={board.reviewsDue.length}
          empty="Nothing due"
          items={board.reviewsDue.slice(0, 4).map((d) => ({
            id: d.id,
            to: `/decisions/${d.id}/review`,
            label: d.title,
          }))}
        />
        <AttentionCard
          title="Predictions due / overdue"
          count={board.predictionsDue.length}
          empty="None due"
          items={board.predictionsDue.slice(0, 4).map((x) => ({
            id: `${x.decision.id}-${x.predictionId}`,
            to: `/decisions/${x.decision.id}#pred-${x.predictionId}`,
            label: `${x.state === 'overdue' ? 'Overdue · ' : ''}${x.predictionStatement} · ${x.expectedDate}`,
          }))}
        />
        <AttentionCard
          title="High-confidence failed assumptions"
          count={board.highConfidenceFailures.length}
          empty="None highlighted"
          items={board.highConfidenceFailures.map((h) => ({
            id: `${h.decisionId}-${h.statement}`,
            to: `/decisions/${h.decisionId}#assumptions`,
            label: `“${h.statement}” (${h.confidence}%)`,
          }))}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Recently reviewed</h2>
          <Link to="/timeline">Timeline</Link>
        </div>
        <ul className="decision-rows">
          {board.recentlyReviewed.map((d) => (
            <li key={d.id}>
              <Link to={`/decisions/${d.id}#review`}>
                <span className="row-title">{d.title}</span>
                <StatusBadge status={d.status} />
              </Link>
            </li>
          ))}
          {!board.recentlyReviewed.length ? (
            <li className="muted">No reviews yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}

function AttentionCard({
  title,
  count,
  empty,
  items,
}: {
  title: string
  count: number
  empty: string
  items: Array<{ id: string; to: string; label: string }>
}) {
  return (
    <article className="signal-card">
      <h2>{title}</h2>
      <p className="signal-count">{count}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link to={item.to}>{item.label}</Link>
          </li>
        ))}
        {!items.length ? <li className="muted">{empty}</li> : null}
      </ul>
    </article>
  )
}
