import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDecisionStore } from '@/application/useDecisionStore'
import { searchDecisionHistory } from '@/domain/historySearch'

export function HistorySearchPage() {
  const { decisions } = useDecisionStore()
  const [query, setQuery] = useState('')
  const hits = useMemo(
    () => searchDecisionHistory(decisions, query),
    [decisions, query],
  )

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Across layers</p>
        <h1>History search</h1>
        <p className="lede">
          Search original context, options, assumptions, predictions, revisions,
          and reviews. Every hit shows temporal provenance — later text is never
          labeled as Known Then.
        </p>
      </header>

      <form
        className="panel filter-bar"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Search history"
      >
        <label>
          Query
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Belief, option, review phrase…"
            autoComplete="off"
          />
        </label>
      </form>

      <section className="panel" aria-live="polite">
        <h2>
          Results
          {query.trim() ? ` (${hits.length})` : ''}
        </h2>
        {!query.trim() ? (
          <p className="muted">Type to search across historical layers.</p>
        ) : hits.length === 0 ? (
          <p className="muted">No matches.</p>
        ) : (
          <ul className="entity-list">
            {hits.map((h, i) => (
              <li key={`${h.decisionId}-${h.layer}-${i}`}>
                <Link to={`/decisions/${h.decisionId}`}>{h.decisionTitle}</Link>
                <span className="pill">{h.layer}</span>
                <span className="muted">{h.provenanceLabel}</span>
                {h.at ? (
                  <span className="muted">{h.at.slice(0, 19)}</span>
                ) : null}
                <p>{h.excerpt.slice(0, 220)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
