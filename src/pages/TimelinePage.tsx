import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDecisionStore } from '@/application/useDecisionStore'
import { buildTimeline } from '@/domain/timeline'

export function TimelinePage() {
  const { decisions } = useDecisionStore()
  const [mode, setMode] = useState<'threads' | 'chronological'>('threads')
  const [horizon, setHorizon] = useState<'all' | 'past' | 'future'>('all')
  const { chronological, byDecision } = useMemo(
    () => buildTimeline(decisions),
    [decisions],
  )

  const filteredChrono = chronological.filter((e) =>
    horizon === 'all' ? true : e.horizon === horizon,
  )

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Time</p>
        <h1>Timeline</h1>
        <p className="lede">
          A temporal map of commits, expectations, revisions, and reviews.
          Titles prefer Known Then when available.
        </p>
        <div className="filter-bar inline-filters" role="group" aria-label="Timeline view">
          <label>
            Layout
            <select
              value={mode}
              onChange={(e) =>
                setMode(e.target.value as 'threads' | 'chronological')
              }
            >
              <option value="threads">Grouped by decision</option>
              <option value="chronological">Global chronology</option>
            </select>
          </label>
          <label>
            Horizon
            <select
              value={horizon}
              onChange={(e) =>
                setHorizon(e.target.value as 'all' | 'past' | 'future')
              }
            >
              <option value="all">All</option>
              <option value="past">Historical</option>
              <option value="future">Future markers</option>
            </select>
          </label>
        </div>
      </header>

      {mode === 'threads' ? (
        <div className="timeline-threads">
          {byDecision.map((thread) => {
            const events = thread.events.filter((e) =>
              horizon === 'all' ? true : e.horizon === horizon,
            )
            if (!events.length) return null
            return (
              <section key={thread.decisionId} className="timeline-thread panel">
                <h2>
                  <Link to={`/decisions/${thread.decisionId}`}>
                    {thread.title}
                  </Link>
                </h2>
                <ol className="timeline">
                  {events.map((e) => (
                    <li key={e.id} className={`tone-${e.tone}`}>
                      <div className="timeline-marker" aria-hidden="true" />
                      <div className="timeline-body">
                        <p className="timeline-kind">
                          {e.kind}
                          {e.horizon === 'future' ? ' · upcoming' : ''}
                        </p>
                        <p className="timeline-date">{e.at.slice(0, 10)}</p>
                        <p className="muted">{e.title}</p>
                        <Link to={`/decisions/${e.decisionId}`}>
                          Open decision
                        </Link>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )
          })}
          {!byDecision.length ? <p className="muted">No events yet.</p> : null}
        </div>
      ) : (
        <ol className="timeline timeline-global panel">
          {filteredChrono.map((e) => (
            <li key={e.id} className={`tone-${e.tone}`}>
              <div className="timeline-marker" aria-hidden="true" />
              <div className="timeline-body">
                <p className="timeline-kind">
                  {e.decisionTitle} · {e.kind}
                </p>
                <p className="timeline-date">{e.at.slice(0, 10)}</p>
                <p className="muted">{e.title}</p>
                <Link to={`/decisions/${e.decisionId}`}>Open decision</Link>
              </div>
            </li>
          ))}
          {!filteredChrono.length ? (
            <li className="muted">No events in this horizon.</li>
          ) : null}
        </ol>
      )}
    </div>
  )
}
