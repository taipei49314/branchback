import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDecision } from '@/application/useDecisionStore'
import {
  buildHistoryExplorer,
  compareExplorerEvents,
} from '@/domain/historyExplorer'

export function HistoryExplorerPage() {
  const { id } = useParams()
  const decision = useDecision(id)
  const events = useMemo(
    () => (decision ? buildHistoryExplorer(decision) : []),
    [decision],
  )
  const [leftId, setLeftId] = useState<string>('')
  const [rightId, setRightId] = useState<string>('')

  const comparison = useMemo(() => {
    if (!decision || !leftId || !rightId) return null
    return compareExplorerEvents(decision, leftId, rightId)
  }, [decision, leftId, rightId])

  if (!decision) {
    return (
      <div className="page">
        <p>Decision not found.</p>
        <Link to="/decisions">Back</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Temporal spine</p>
        <h1>History explorer</h1>
        <p className="lede">
          Navigate commit → revisions → reviews without reading JSON. Later
          layers stay labeled as later.
        </p>
        <p>
          <Link to={`/decisions/${decision.id}`}>{decision.title}</Link>
        </p>
      </header>

      <section className="panel">
        <h2>Timeline</h2>
        {events.length ? (
          <ol className="revision-timeline history-sequence">
            {events.map((ev) => (
              <li key={ev.id}>
                <p className="timeline-kind">{ev.label}</p>
                <p className="timeline-date">{ev.at.slice(0, 19)}</p>
                <p>{ev.detail}</p>
                {ev.changes?.length ? (
                  <ul className="change-list">
                    {ev.changes.map((c, i) => (
                      <li key={`${c.field}-${i}`}>
                        <strong>{c.label}:</strong> {c.before} → {c.after}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {ev.review ? (
                  <dl className="kv nested">
                    <div>
                      <dt>What happened</dt>
                      <dd>{ev.review.whatHappened || '—'}</dd>
                    </div>
                    {ev.review.memoryDriftNotes ? (
                      <div>
                        <dt>Memory drift</dt>
                        <dd>{ev.review.memoryDriftNotes}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">No committed history yet.</p>
        )}
      </section>

      <section className="panel stack">
        <h2>Compare two events</h2>
        <div className="filter-bar">
          <label>
            Earlier / left
            <select
              value={leftId}
              onChange={(e) => setLeftId(e.target.value)}
            >
              <option value="">Select…</option>
              {events.map((ev) => (
                <option key={`l-${ev.id}`} value={ev.id}>
                  {ev.label} · {ev.at.slice(0, 10)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Later / right
            <select
              value={rightId}
              onChange={(e) => setRightId(e.target.value)}
            >
              <option value="">Select…</option>
              {events.map((ev) => (
                <option key={`r-${ev.id}`} value={ev.id}>
                  {ev.label} · {ev.at.slice(0, 10)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {comparison ? <p>{comparison.summary}</p> : null}
      </section>
    </div>
  )
}
